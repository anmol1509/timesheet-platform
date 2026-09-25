"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isDraftType } from "@/lib/draftTypes";
import { assertContactsValid } from "@/lib/validators";

const MAX_PAYLOAD_BYTES = 200_000;
type Result = { ok: boolean; error?: string; savedAt?: string };

/** Saves (or replaces) the caller's draft of one form. Nothing in it is validated: half-finished is the point. */
export async function saveDraftAction(input: { type: string; key?: string; title?: string | null; payload: unknown }): Promise<Result> {
  const { user, branchId } = await requireUserWithBranch();
  if (!isDraftType(input.type)) return { ok: false, error: "Unknown form." };
  const json = JSON.stringify(input.payload ?? {});
  if (json.length > MAX_PAYLOAD_BYTES) return { ok: false, error: "This draft is too large to save." };
  const key = (input.key || "new").slice(0, 80);
  const title = input.title ? String(input.title).trim().slice(0, 120) || null : null;
  const payload = JSON.parse(json);
  try {
    const row = await prisma.draft.upsert({
      where: { userId_type_key: { userId: user.id, type: input.type, key } },
      create: { userId: user.id, type: input.type, key, title, payload, branchId },
      update: { title, payload, branchId },
      select: { updatedAt: true },
    });
    revalidatePath("/drafts");
    return { ok: true, savedAt: row.updatedAt.toISOString() };
  } catch {
    // The drafts table may not exist yet on this database; the form must keep working without it.
    return { ok: false, error: "Drafts aren't available right now." };
  }
}

/** The caller's draft of one form, if there is one. */
export async function loadDraftAction(input: { type: string; key?: string }): Promise<{ payload: unknown; title: string | null; updatedAt: string } | null> {
  const { user } = await requireUserWithBranch();
  if (!isDraftType(input.type)) return null;
  try {
    const row = await prisma.draft.findUnique({ where: { userId_type_key: { userId: user.id, type: input.type, key: input.key || "new" } } });
    return row ? { payload: row.payload, title: row.title, updatedAt: row.updatedAt.toISOString() } : null;
  } catch {
    return null;
  }
}

export async function discardDraftAction(input: { type: string; key?: string }): Promise<Result> {
  const { user } = await requireUserWithBranch();
  if (!isDraftType(input.type)) return { ok: false, error: "Unknown form." };
  try {
    await prisma.draft.deleteMany({ where: { userId: user.id, type: input.type, key: input.key || "new" } });
  } catch {
    return { ok: false, error: "Drafts aren't available right now." };
  }
  revalidatePath("/drafts");
  return { ok: true };
}

/** Form-post variant for the Drafts list. */
export async function discardDraftByIdAction(formData: FormData) {
  assertContactsValid(formData);
  const { user } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");
  if (id) await prisma.draft.deleteMany({ where: { id, userId: user.id } }).catch(() => undefined);
  revalidatePath("/drafts");
}
