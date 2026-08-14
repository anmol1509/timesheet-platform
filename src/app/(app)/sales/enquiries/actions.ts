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

async function assertEnquiryInBranch(id: string, branchId: string | null, isSuperAdmin: boolean) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id }, select: { branchId: true } });
  return !!enquiry && !isOutsideBranch(enquiry.branchId, branchId, isSuperAdmin);
}

export async function createEnquiryAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  if (!clientId || !branchId) return;

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { branchId: true } });
  if (!client || isOutsideBranch(client.branchId, branchId, isSuperAdmin)) return;

  const data = {
    clientId,
    branchId,
    projectHint: stringOrNull(formData.get("projectHint")),
    requiredTrade: stringOrNull(formData.get("requiredTrade")),
    source: stringOrNull(formData.get("source")),
    remarks: stringOrNull(formData.get("remarks")),
    requestedById: user.id,
  };

  const created = await prisma.enquiry.create({ data });

  await logAudit({
    entityType: "ENQUIRY",
    entityId: created.id,
    action: "CREATE",
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/sales/enquiries");
  redirect("/sales/enquiries");
}

export async function updateEnquiryAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("enquiryId") || "");
  if (!id) return;
  if (!(await assertEnquiryInBranch(id, branchId, isSuperAdmin))) return;

  const before = await prisma.enquiry.findUnique({ where: { id } });

  const data = {
    status: stringOrNull(formData.get("status")) || "Open",
    projectHint: stringOrNull(formData.get("projectHint")),
    requiredTrade: stringOrNull(formData.get("requiredTrade")),
    source: stringOrNull(formData.get("source")),
    remarks: stringOrNull(formData.get("remarks")),
  };

  await prisma.enquiry.update({ where: { id }, data });

  await logAudit({
    entityType: "ENQUIRY",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/sales/enquiries");
}

export async function deleteEnquiryAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("enquiryId") || "");
  if (!id) return;
  if (!(await assertEnquiryInBranch(id, branchId, isSuperAdmin))) return;

  const before = await prisma.enquiry.findUnique({ where: { id } });
  if (!before) return;

  // Quotations point back at the enquiry they came from; dropping it would
  // orphan that trail, so the quotations have to go (or be deleted) first.
  const quotationCount = await prisma.quotation.count({ where: { enquiryId: id } });
  if (quotationCount > 0) {
    redirect(
      `/sales/enquiries?error=${encodeURIComponent(
        `Can't delete — ${quotationCount} quotation(s) came from this enquiry.`
      )}`
    );
  }

  await prisma.enquiry.delete({ where: { id } });

  await logAudit({
    entityType: "ENQUIRY",
    entityId: id,
    action: "DELETE",
    before: before as unknown as Record<string, unknown>,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/sales/enquiries");
}
