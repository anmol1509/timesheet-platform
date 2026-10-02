"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

function dateOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(s) : null;
}

export async function createNocAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const demandRequestId = String(formData.get("demandRequestId") || "");
  const templateId = String(formData.get("templateId") || "");
  const employeeIds = formData.getAll("employeeId").map(String).filter(Boolean);
  const displayFields = String(formData.get("displayFields") || "");
  const mobilizeDate = dateOrNull(formData.get("mobilizeDate"));
  const remarks = stringOrNull(formData.get("remarks"));
  if (!demandRequestId || !templateId || !branchId) return;

  const [request, template] = await Promise.all([
    prisma.demandRequest.findUnique({ where: { id: demandRequestId }, select: { branchId: true } }),
    prisma.letterTemplate.findUnique({ where: { id: templateId }, select: { branchId: true } }),
  ]);
  if (!request || isOutsideBranch(request.branchId, branchId, isSuperAdmin)) return;
  if (!template || isOutsideBranch(template.branchId, branchId, isSuperAdmin)) return;

  const created = await prisma.noc.create({
    data: {
      demandRequestId,
      templateId,
      branchId,
      displayFields: displayFields || null,
      mobilizeDate,
      remarks,
      requestedById: user.id,
      employees: { create: employeeIds.map((employeeId) => ({ employeeId })) },
    },
  });

  await logAudit({
    entityType: "NOC",
    entityId: created.id,
    action: "CREATE",
    after: { demandRequestId, templateId, employeeIds, displayFields, mobilizeDate },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/operations/nocs");
  redirect(`/operations/nocs/${created.id}`);
}

export async function deleteNocAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("projects", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("nocId") || "");
  if (!id) return;

  const existing = await prisma.noc.findUnique({ where: { id } });
  if (!existing || isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) return;

  await prisma.noc.delete({ where: { id } });

  await logAudit({
    entityType: "NOC",
    entityId: id,
    action: "DELETE",
    before: { docNo: existing.docNo, demandRequestId: existing.demandRequestId },
    userId: user.id,
    userName: user.name,
    branchId: existing.branchId,
  });

  revalidatePath("/operations/nocs");
  redirect("/operations/nocs");
}


/**
 * Issues a NOC from a demand's documents screen without leaving it. Only workers
 * mobilised on that demand can be listed, and only a No Objection Letter template
 * can be used.
 */
export async function issueNocAction(formData: FormData): Promise<{ id?: string; error?: string }> {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const demandRequestId = String(formData.get("demandRequestId") || "");
  const templateId = String(formData.get("templateId") || "");
  const asked = [...new Set(formData.getAll("employeeId").map(String).filter(Boolean))];
  const displayFields = String(formData.get("displayFields") || "");
  const mobilizeDate = dateOrNull(formData.get("mobilizeDate"));
  const remarks = stringOrNull(formData.get("remarks"));
  if (!branchId) return { error: "Pick a branch first." };
  if (!demandRequestId || !templateId) return { error: "Choose a template." };
  if (asked.length === 0) return { error: "Tick at least one worker." };

  const [request, template] = await Promise.all([
    prisma.demandRequest.findUnique({
      where: { id: demandRequestId },
      select: { branchId: true, trades: { select: { allocations: { select: { employeeId: true } } } } },
    }),
    prisma.letterTemplate.findUnique({ where: { id: templateId }, select: { branchId: true, category: true } }),
  ]);
  if (!request || isOutsideBranch(request.branchId, branchId, isSuperAdmin)) return { error: "Demand not found." };
  if (!template || isOutsideBranch(template.branchId, branchId, isSuperAdmin)) return { error: "Template not found." };
  if (template.category !== "No Objection Letter") return { error: "That isn't a NOC template." };
  const mobilised = new Set(request.trades.flatMap((t) => t.allocations.map((a) => a.employeeId)));
  const employeeIds = asked.filter((id) => mobilised.has(id));
  if (employeeIds.length !== asked.length) return { error: "Some of those workers aren't mobilised on this demand." };

  const created = await prisma.noc.create({
    data: {
      demandRequestId,
      templateId,
      branchId: request.branchId,
      displayFields: displayFields || null,
      mobilizeDate,
      remarks,
      requestedById: user.id,
      employees: { create: employeeIds.map((employeeId) => ({ employeeId })) },
    },
  });
  await logAudit({
    entityType: "NOC",
    entityId: created.id,
    action: "CREATE",
    after: { demandRequestId, templateId, employeeIds, displayFields, mobilizeDate },
    userId: user.id,
    userName: user.name,
    branchId: request.branchId,
  });
  revalidatePath("/operations/nocs");
  revalidatePath(`/demand/${demandRequestId}/documents`);
  revalidatePath("/letters");
  return { id: created.id };
}
