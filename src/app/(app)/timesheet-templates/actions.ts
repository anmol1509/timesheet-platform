"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { isTemplateKey, templateByKey } from "@/lib/timesheetTemplates";
import { defaultConfig, normalizeConfig } from "@/lib/timesheetTemplateConfig";
import { assertContactsValid } from "@/lib/validators";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

async function ownTemplate(id: string) {
  await requireAdmin();
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const row = id ? await prisma.timesheetTemplate.findUnique({ where: { id } }) : null;
  const ok = row && !isOutsideBranch(row.branchId, branchId, isSuperAdmin);
  return { user, branchId, row: ok ? row : null };
}

/** A name not yet used in this company: "Name", then "Name (2)", "Name (3)". */
async function freeName(branchId: string, wanted: string) {
  for (let n = 1; n < 200; n++) {
    const name = n === 1 ? wanted : `${wanted} (${n})`;
    if (!(await prisma.timesheetTemplate.findFirst({ where: { branchId, name: { equals: name, mode: "insensitive" } }, select: { id: true } }))) return name;
  }
  return `${wanted} ${Date.now()}`;
}

/** Starts the company's own copy of a built-in layout and opens the editor. */
export async function customiseTemplateAction(formData: FormData) {
  assertContactsValid(formData);
  await requireAdmin();
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) redirect("/timesheet-templates?error=" + encodeURIComponent("Pick a branch first."));
  const baseKey = str(formData.get("baseKey"));
  if (!isTemplateKey(baseKey)) redirect("/timesheet-templates");
  const created = await prisma.timesheetTemplate.create({
    data: { branchId, baseKey, name: await freeName(branchId, `${templateByKey(baseKey).name} (custom)`), config: defaultConfig(baseKey) },
  });
  await logAudit({ entityType: "TIMESHEET_TEMPLATE", entityId: created.id, action: "CREATE", after: { name: created.name, baseKey }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/timesheet-templates");
  redirect(`/timesheet-templates/${created.id}`);
}

export async function saveTimesheetTemplateAction(_prev: State, formData: FormData): Promise<State> {
  const { user, branchId, row } = await ownTemplate(str(formData.get("id")));
  if (!row) return { error: "That template isn't available." };
  const name = str(formData.get("name"));
  if (!name) return { error: "Give the template a name." };
  if (name.length > 80) return { error: "Keep the name under 80 characters." };
  if (name.toLowerCase() !== row.name.toLowerCase() || name !== row.name) {
    const clash = await prisma.timesheetTemplate.findFirst({ where: { branchId: row.branchId, name: { equals: name, mode: "insensitive" }, NOT: { id: row.id } }, select: { id: true } });
    if (clash) return { error: `Another template is already called "${name}".` };
  }
  let raw: unknown = null;
  try { raw = JSON.parse(str(formData.get("config")) || "null"); } catch { return { error: "The settings couldn't be read. Reload the page and try again." }; }
  const config = normalizeConfig(isTemplateKey(row.baseKey) ? row.baseKey : "standard", raw);
  await prisma.timesheetTemplate.update({ where: { id: row.id }, data: { name, config } });
  await logAudit({ entityType: "TIMESHEET_TEMPLATE", entityId: row.id, action: "UPDATE", after: { name }, userId: user.id, userName: user.name, branchId: row.branchId ?? branchId });
  revalidatePath("/timesheet-templates");
  revalidatePath(`/timesheet-templates/${row.id}`);
  return { error: null, ok: true };
}

export async function duplicateTimesheetTemplateAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, row } = await ownTemplate(str(formData.get("id")));
  if (!row) redirect("/timesheet-templates");
  const created = await prisma.timesheetTemplate.create({ data: { branchId: row.branchId, baseKey: row.baseKey, name: await freeName(row.branchId, `${row.name} copy`), config: row.config as object } });
  await logAudit({ entityType: "TIMESHEET_TEMPLATE", entityId: created.id, action: "CREATE", after: { name: created.name, copiedFrom: row.id }, userId: user.id, userName: user.name, branchId: row.branchId });
  revalidatePath("/timesheet-templates");
  redirect(`/timesheet-templates/${created.id}`);
}

export async function deleteTimesheetTemplateAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, row } = await ownTemplate(str(formData.get("id")));
  if (!row) redirect("/timesheet-templates");
  await prisma.timesheetTemplate.delete({ where: { id: row.id } });
  await logAudit({ entityType: "TIMESHEET_TEMPLATE", entityId: row.id, action: "DELETE", before: { name: row.name }, userId: user.id, userName: user.name, branchId: row.branchId });
  revalidatePath("/timesheet-templates");
  redirect("/timesheet-templates");
}
