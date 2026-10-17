"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

/** Deletes the chosen documents (the ones in this branch), with an audit entry for each. */
export async function deleteDocumentsAction(ids: string[]): Promise<{ deleted: number; error?: string }> {
  await requirePermission("workforce", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const wanted = [...new Set(ids.filter((id) => typeof id === "string" && id))].slice(0, 200);
  if (wanted.length === 0) return { deleted: 0, error: "Choose at least one document." };

  const docs = await prisma.document.findMany({
    where: { id: { in: wanted } },
    select: { id: true, type: true, filename: true, expiryDate: true, employeeId: true, employee: { select: { branchId: true } } },
  });
  const mine = docs.filter((d) => !isOutsideBranch(d.employee.branchId, branchId, isSuperAdmin));
  if (mine.length === 0) return { deleted: 0, error: "Those documents weren't found." };

  await prisma.document.deleteMany({ where: { id: { in: mine.map((d) => d.id) } } });
  for (const d of mine) {
    await logAudit({
      entityType: "DOCUMENT",
      entityId: d.id,
      action: "DELETE",
      before: { employeeId: d.employeeId, type: d.type, filename: d.filename, expiryDate: d.expiryDate },
      userId: user.id,
      userName: user.name,
      branchId,
    });
    revalidatePath(`/employees/${d.employeeId}`);
  }
  revalidatePath("/documents");
  return { deleted: mine.length };
}
