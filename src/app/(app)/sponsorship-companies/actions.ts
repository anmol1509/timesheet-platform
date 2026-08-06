"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

export async function createSponsorshipCompanyAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const shortName = String(formData.get("shortName") || "").trim() || null;

  if (!branchId) {
    redirect(
      `/sponsorship-companies?error=${encodeURIComponent(
        isSuperAdmin
          ? "Pick a branch from the switcher before adding a sponsorship company."
          : "Your account has no branch assigned — contact an admin."
      )}`
    );
  }

  const created = await prisma.sponsorshipCompany.create({ data: { name, shortName, branchId } });

  await logAudit({
    entityType: "SPONSORSHIP_COMPANY",
    entityId: created.id,
    action: "CREATE",
    after: { name, shortName },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/sponsorship-companies");
}

export async function updateSponsorshipCompanyAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("sponsorshipCompanyId") || "");
  if (!id) return;

  const existing = await prisma.sponsorshipCompany.findUnique({ where: { id } });
  if (!existing || isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) return;

  const data = {
    shortName: stringOrNull(formData.get("shortName")),
    address: stringOrNull(formData.get("address")),
    country: stringOrNull(formData.get("country")),
    currency: stringOrNull(formData.get("currency")),
    phone: stringOrNull(formData.get("phone")),
    email: stringOrNull(formData.get("email")),
    tradeLicenseNumber: stringOrNull(formData.get("tradeLicenseNumber")),
  };

  await prisma.sponsorshipCompany.update({ where: { id }, data });

  await logAudit({
    entityType: "SPONSORSHIP_COMPANY",
    entityId: id,
    action: "UPDATE",
    before: existing as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/sponsorship-companies/${id}`);
  revalidatePath("/sponsorship-companies");
}

export async function deleteSponsorshipCompanyAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("sponsorshipCompanyId") || "");
  if (!id) return;

  const target = await prisma.sponsorshipCompany.findUnique({ where: { id } });
  if (!target || isOutsideBranch(target.branchId, branchId, isSuperAdmin)) return;

  const employeeCount = await prisma.employee.count({ where: { sponsorshipCompanyId: id } });
  if (employeeCount > 0) {
    redirect(
      `/sponsorship-companies?error=${encodeURIComponent(
        `Can't delete — still linked to ${employeeCount} employee(s).`
      )}`
    );
  }

  await prisma.sponsorshipCompany.delete({ where: { id } });

  await logAudit({
    entityType: "SPONSORSHIP_COMPANY",
    entityId: id,
    action: "DELETE",
    before: target as unknown as Record<string, unknown>,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/sponsorship-companies");
}
