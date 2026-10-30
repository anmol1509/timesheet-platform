"use server";

import { revalidatePath } from "next/cache";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { restoreDeleted } from "@/lib/trash";

export async function restoreDeletedAction(id: string): Promise<{ ok: true; label: string; href: string | null; notes: string[] } | { ok: false; error: string }> {
  const { user, branchId } = await requireUserWithBranch();
  const r = await restoreDeleted(id, { id: user.id, name: user.name, role: user.role, permissions: subjectOf(user).permissions, branchId });
  if (r.ok) {
    revalidatePath("/trash");
    revalidatePath("/employees");
    revalidatePath("/documents");
    revalidatePath("/audit-log");
  }
  return r;
}
