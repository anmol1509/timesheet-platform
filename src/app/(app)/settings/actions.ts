"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { setActiveBranchCookie } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";

const ROLES = ["SUPER_ADMIN", "BRANCH_ADMIN", "STAFF"] as const;
type RoleValue = (typeof ROLES)[number];

export async function updateIssuedToAction(formData: FormData) {
  assertContactsValid(formData);
  const admin = await requireAdmin();
  const branchId = String(formData.get("branchId") || "");
  const issuedTo = String(formData.get("issuedTo") || "").trim();
  const companyTrn = String(formData.get("companyTrn") || "").trim() || null;
  if (!issuedTo || !branchId) return;
  // A branch admin edits only their own branch; a super admin any. These are the
  // name and tax number printed on a branch's invoices and sheets, so one tenant
  // must never be able to change another's.
  if (admin.role !== "SUPER_ADMIN" && admin.branchId !== branchId) return;

  const before = await prisma.branch.findUnique({ where: { id: branchId }, select: { issuedTo: true, trn: true } });
  if (!before) return;

  await prisma.branch.update({ where: { id: branchId }, data: { issuedTo, trn: companyTrn } });

  await logAudit({
    entityType: "BRANCH",
    entityId: branchId,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: { issuedTo, trn: companyTrn },
    userId: admin.id,
    userName: admin.name,
    branchId,
  });

  revalidatePath("/settings");
  revalidatePath("/settings/company");
}

export async function createBranchAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null; ok?: boolean }> {
  assertContactsValid(formData);
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
  let copied: { lookups: number; templates: number } | null = null;
  if (copyFromId) {
    const [lookups, templates] = await Promise.all([
      prisma.lookupValue.findMany({ where: { branchId: copyFromId }, select: { category: true, value: true, sortOrder: true, isActive: true } }),
      prisma.letterTemplate.findMany({ where: { branchId: copyFromId }, select: { name: true, category: true, remarksText: true } }),
    ]);
    await prisma.$transaction([
      prisma.lookupValue.createMany({ data: lookups.map((l) => ({ ...l, branchId: created.id })), skipDuplicates: true }),
      prisma.letterTemplate.createMany({ data: templates.map((t) => ({ ...t, branchId: created.id })) }),
    ]);
    copied = { lookups: lookups.length, templates: templates.length };
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
