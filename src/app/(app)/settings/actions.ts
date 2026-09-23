"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const ROLES = ["SUPER_ADMIN", "BRANCH_ADMIN", "STAFF"] as const;
type RoleValue = (typeof ROLES)[number];

export async function updateIssuedToAction(formData: FormData) {
  const admin = await requireAdmin();
  const issuedTo = String(formData.get("issuedTo") || "").trim();
  const companyTrn = String(formData.get("companyTrn") || "").trim() || null;
  if (!issuedTo) return;

  const before = await prisma.settings.findUnique({ where: { id: "singleton" } });

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { issuedTo, companyTrn },
    create: { id: "singleton", issuedTo, companyTrn },
  });

  await logAudit({
    entityType: "SETTINGS",
    entityId: "singleton",
    action: before ? "UPDATE" : "CREATE",
    before: before ? (before as unknown as Record<string, unknown>) : undefined,
    after: { issuedTo, companyTrn },
    userId: admin.id,
    userName: admin.name,
    branchId: null,
  });

  revalidatePath("/settings");
}

export async function createBranchAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  if (admin.role !== "SUPER_ADMIN") return { error: "Only a super admin can add branches." };

  const code = String(formData.get("code") || "").trim().toUpperCase();
  const name = String(formData.get("name") || "").trim();
  const emirate = String(formData.get("emirate") || "").trim() || null;

  if (!code || !name) {
    return { error: "Enter a branch code and name." };
  }

  const existing = await prisma.branch.findUnique({ where: { code } });
  if (existing) {
    return { error: "A branch with that code already exists." };
  }

  const created = await prisma.branch.create({ data: { code, name, emirate } });

  await logAudit({
    entityType: "BRANCH",
    entityId: created.id,
    action: "CREATE",
    after: { code, name, emirate },
    userId: admin.id,
    userName: admin.name,
    branchId: created.id,
  });

  revalidatePath("/settings");
  return { error: null };
}
