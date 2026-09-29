"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getEssEmployee } from "@/lib/ess/session";
import { PROFILE_FIELDS, validateProfileValue } from "@/lib/ess/profileFields";

export type ProfileResult = {
  saved: number;
  errors: Record<string, string>;
  /** What was typed, sent back when something failed so the form can put it back (a submitted form clears itself). */
  values?: Record<string, string>;
} | null;

/** Fill in details that are missing from the signed-in worker's own record. Nothing already on file is changed. */
export async function completeMyProfileAction(_prev: ProfileResult, formData: FormData): Promise<ProfileResult> {
  const me = await getEssEmployee();
  if (!me) return { saved: 0, errors: { _: "Please sign in again." } };

  // Read the record fresh: "empty" must be true now, not when the page was drawn.
  const current = await prisma.employee.findUnique({ where: { id: me.id } });
  if (!current) return { saved: 0, errors: { _: "Your record wasn't found." } };

  const typed: Record<string, string> = {};
  for (const f of PROFILE_FIELDS) typed[f.key] = String(formData.get(f.key) ?? "");
  const errors: Record<string, string> = {};
  const data: Record<string, string | Date> = {};
  for (const f of PROFILE_FIELDS) {
    const raw = String(formData.get(f.key) ?? "").trim();
    if (!raw) continue;
    const already = (current as Record<string, unknown>)[f.key];
    if (already !== null && already !== undefined && String(already).trim() !== "") continue; // never overwrite
    const res = validateProfileValue(f, raw);
    if ("error" in res) errors[f.key] = res.error;
    else data[f.key] = res.value;
  }
  if (Object.keys(errors).length > 0) return { saved: 0, errors, values: typed };
  if (Object.keys(data).length === 0) return { saved: 0, errors: {} };

  await prisma.employee.update({ where: { id: me.id }, data });
  await prisma.auditLog.create({
    data: {
      entityType: "EMPLOYEE",
      entityId: me.id,
      action: "UPDATE",
      changes: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, { from: null, to: v instanceof Date ? v.toISOString().slice(0, 10) : v }])),
      userId: `ess:${me.id}`,
      userName: `${current.name} (self-service)`,
      branchId: current.branchId,
    },
  });
  revalidatePath("/me");
  revalidatePath("/me/profile");
  return { saved: Object.keys(data).length, errors: {} };
}
