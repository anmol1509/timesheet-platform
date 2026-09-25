import { prisma } from "@/lib/db";

/** Called by a create action after the record is really saved, so the draft it grew from doesn't linger. */
export async function clearDraft(userId: string, type: string, key = "new") {
  await prisma.draft.deleteMany({ where: { userId, type, key } }).catch(() => undefined);
}
