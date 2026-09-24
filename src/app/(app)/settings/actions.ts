"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { setActiveBranchCookie } from "@/lib/session";
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
): Promise<{ error: string | null; ok?: boolean }> {
  const admin = await requireAdmin();
  if (admin.role !== "SUPER_ADMIN") return { error: "Only a super admin can add branches." };

  const code = String(formData.get("code") || "").trim().toUpperCase();
  const name = String(formData.get("name") || "").trim();
  const emirate = String(formData.get("emirate") || "").trim() || null;
  const copyFromId = String(formData.get("copyFromBranchId") || "") || null;
  const switchTo = formData.get("switchTo") === "1";

  if (!code || !name) {
    return { error: "Enter a branch code and name." };
  }
  if (!/^[A-Z0-9_-]{2,10}$/.test(code)) {
    return { error: "The code should be 2–10 letters or numbers, e.g. DXB." };
  }

  const existing = await prisma.branch.findUnique({ where: { code } });
  if (existing) {
    return { error: "A branch with that code already exists." };
  }

  const created = await prisma.branch.create({ data: { code, name, emirate } });

  // Optionally seed the new branch with the *setup* (never the data) of an
  // existing one, so its dropdowns, leave types and letter templates aren't
  // blank. People, projects, clients, banks and records are never copied.
  let copied: { lookups: number; leaveTypes: number; templates: number } | null = null;
  if (copyFromId) {
    const [lookups, leaveTypes, templates] = await Promise.all([
      prisma.lookupValue.findMany({ where: { branchId: copyFromId }, select: { category: true, value: true, sortOrder: true, isActive: true } }),
      prisma.leaveType.findMany({ where: { branchId: copyFromId }, select: { name: true, code: true, paid: true, daysPerYear: true, isActive: true } }),
      prisma.letterTemplate.findMany({ where: { branchId: copyFromId }, select: { name: true, category: true, remarksText: true } }),
    ]);
    await prisma.$transaction([
      prisma.lookupValue.createMany({ data: lookups.map((l) => ({ ...l, branchId: created.id })), skipDuplicates: true }),
      prisma.leaveType.createMany({ data: leaveTypes.map((l) => ({ ...l, branchId: created.id })), skipDuplicates: true }),
      prisma.letterTemplate.createMany({ data: templates.map((t) => ({ ...t, branchId: created.id })) }),
    ]);
    copied = { lookups: lookups.length, leaveTypes: leaveTypes.length, templates: templates.length };
  }

  await logAudit({
    entityType: "BRANCH",
    entityId: created.id,
    action: "CREATE",
    after: { code, name, emirate, copiedSetupFrom: copyFromId, copied },
    userId: admin.id,
    userName: admin.name,
    branchId: created.id,
  });

  if (switchTo) await setActiveBranchCookie(created.id);
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}
