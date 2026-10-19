import { prisma } from "@/lib/db";
import { isLocked } from "./ledger";
import { utcDay } from "./postings";

/**
 * An error message when a payment or receipt dated `date` would fall in a closed accounting period (it could never be
 * posted to the books), otherwise null. Branches whose books are not set up have no locked periods.
 */
export async function lockedPeriodError(branchId: string | null, date: Date): Promise<string | null> {
  if (!branchId) return null;
  const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { booksOpeningDate: true, booksLockedUntil: true } });
  if (!b?.booksOpeningDate || !b.booksLockedUntil) return null;
  return isLocked(utcDay(date), utcDay(b.booksLockedUntil))
    ? `That date is in a closed accounting period (locked up to ${utcDay(b.booksLockedUntil).toISOString().slice(0, 10)}). Use a later date, or ask your accountant to unlock the period.`
    : null;
}

/**
 * Marks a branch's books as out of date, so the next time they are opened they catch up straight away instead of up to
 * half a minute later. Called after a payment or receipt is recorded elsewhere in the app.
 */
export async function markBooksStale(branchId: string | null | undefined): Promise<void> {
  if (!branchId) return;
  await prisma.branch.updateMany({ where: { id: branchId, booksOpeningDate: { not: null } }, data: { booksSyncedAt: null } }).catch(() => {});
}
