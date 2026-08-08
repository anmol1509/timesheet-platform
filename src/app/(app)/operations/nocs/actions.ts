"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

function dateOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(s) : null;
}

export async function createNocAction(formData: FormData) {
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
