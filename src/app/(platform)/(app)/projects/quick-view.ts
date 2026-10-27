"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";
import { PEOPLE, readPeople } from "@/lib/projectPeople";

/**
 * The project quick view: status, timeline, headcount, address and the three named contacts, saved one thing at a
 * time with the rules the project form applies (a named person needs a phone number). Client, sites, LPOs, rates,
 * holidays and inventory stay on the full project page.
 */
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const SCOPE = "projects.projects";
const STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"];

export type ProjectPerson = { name: string | null; phone: string | null; email: string | null };
export type ProjectQuickView = {
  id: string;
  code: string;
  name: string;
  clientName: string;
  status: string;
  timelineStart: string | null;
  timelineEnd: string | null;
  noOfEmployeesRequired: number | null;
  address: string | null;
  manager: ProjectPerson;
  projectCoordinator: ProjectPerson;
  salesExecutive: ProjectPerson;
  canEdit: boolean;
};

export async function loadProjectQuickViewAction(id: string): Promise<ProjectQuickView | null> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const p = await prisma.project.findUnique({ where: { id }, include: { client: { select: { name: true } } } });
  if (!p || isOutsideBranch(p.branchId, branchId, isSuperAdmin)) return null;
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    clientName: p.client.name,
    status: p.status,
    timelineStart: iso(p.timelineStart),
    timelineEnd: iso(p.timelineEnd),
    noOfEmployeesRequired: p.noOfEmployeesRequired,
    address: p.address,
    manager: { name: p.manager, phone: p.managerPhone, email: p.managerEmail },
    projectCoordinator: { name: p.projectCoordinator, phone: p.projectCoordinatorPhone, email: p.projectCoordinatorEmail },
    salesExecutive: { name: p.salesExecutive, phone: p.salesExecutivePhone, email: p.salesExecutiveEmail },
    canEdit: canWrite(subjectOf(user), SCOPE),
  };
}

export type ProjectSaveResult = { ok: true; value: string | null; previous: string | null } | { ok?: false; error?: string };

const FIELDS = new Set(["status", "timelineStart", "timelineEnd", "noOfEmployeesRequired", "address"]);

/** Saves the status, timeline, headcount or address of a project. */
export async function saveProjectFieldAction(input: { id: string; field: string; value: string | null }): Promise<ProjectSaveResult> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!canWrite(subjectOf(user), SCOPE)) return { error: "You don't have permission to edit projects." };
  const { id, field } = input;
  if (!FIELDS.has(field)) return { error: "That field can't be edited here." };
  const before = await prisma.project.findUnique({ where: { id } });
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) return { error: "That project isn't in this company." };

  const raw = (input.value ?? "").trim();
  let value: string | number | Date | null = raw || null;
  if (field === "status" && (!value || !STATUSES.includes(value as string))) return { error: "Choose a valid status." };
  if (field === "timelineStart" || field === "timelineEnd") {
    if (value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value as string) || Number.isNaN(new Date(value as string).getTime())) return { error: "Enter a valid date." };
      value = new Date(value as string);
    }
    const start = field === "timelineStart" ? (value as Date | null) : before.timelineStart;
    const end = field === "timelineEnd" ? (value as Date | null) : before.timelineEnd;
    if (start && end && end < start) return { error: field === "timelineEnd" ? "The end date can't be before the start date." : "The start date can't be after the end date." };
  }
  if (field === "noOfEmployeesRequired" && value !== null) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 100000) return { error: "Enter a whole number of workers." };
    value = n;
  }
  try {
    const f = new FormData();
    if (typeof value === "string") f.set(field, value);
    assertContactsValid(f);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That value isn't valid." };
  }

  await prisma.project.update({ where: { id }, data: { [field]: value } });
  const prev = (before as Record<string, unknown>)[field];
  await logAudit({ entityType: "PROJECT", entityId: id, action: "UPDATE", before: { [field]: prev }, after: { [field]: value }, userId: user.id, userName: user.name, branchId });
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  const out = (v: unknown) => (v instanceof Date ? iso(v) : v === null || v === undefined ? null : String(v));
  return { ok: true, value: out(value), previous: out(prev) };
}

/**
 * Saves one of the project's three named contacts. A name needs a reachable phone number, and clearing the name
 * clears the contact, exactly as on the project form.
 */
export async function saveProjectPersonAction(input: { id: string; person: string; name: string; phone: string; email: string }): Promise<{ ok: true } | { error: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!canWrite(subjectOf(user), SCOPE)) return { error: "You don't have permission to edit projects." };
  if (!PEOPLE.some((p) => p.key === input.person)) return { error: "That contact can't be edited here." };
  const before = await prisma.project.findUnique({ where: { id: input.id } });
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) return { error: "That project isn't in this company." };

  try {
    const f = new FormData();
    f.set(`${input.person}Phone`, input.phone);
    f.set(`${input.person}Email`, input.email);
    assertContactsValid(f);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That value isn't valid." };
  }
  const form = new FormData();
  form.set(input.person, input.name);
  form.set(`${input.person}Phone`, input.phone);
  form.set(`${input.person}Email`, input.email);
  const people = readPeople(form, [input.person]);
  if (!people.data) return { error: people.error ?? "That contact isn't valid." };

  await prisma.project.update({ where: { id: input.id }, data: people.data });
  const was = Object.fromEntries(Object.keys(people.data).map((k) => [k, (before as Record<string, unknown>)[k]]));
  await logAudit({ entityType: "PROJECT", entityId: input.id, action: "UPDATE", before: was, after: people.data, userId: user.id, userName: user.name, branchId });
  revalidatePath(`/projects/${input.id}`);
  revalidatePath("/projects");
  return { ok: true };
}
