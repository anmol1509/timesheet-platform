import { prisma } from "@/lib/db";

/** Called by a create action after the record is really saved, so the draft it grew from doesn't linger. Never allowed to fail the save. */
export async function clearDraft(userId: string, type: string, key = "new") {
  try {
    await prisma.draft.deleteMany({ where: { userId, type, key } });
  } catch {
    /* drafts unavailable (table missing or stale client): the record itself is already saved */
  }
}
