import { prisma } from "@/lib/db";
import { papersPendingFrom, seedPapers } from "@/lib/papers";

/** Works out "papers pending" from the worker's paper rows and stores it on the worker. A worker with no rows isn't tracked, so isn't pending. */
export async function refreshPapersPending(employeeId: string): Promise<boolean> {
  const rows = await prisma.employeePaper.findMany({ where: { employeeId }, select: { item: true, status: true } });
  const pending = rows.length > 0 && papersPendingFrom(rows);
  await prisma.employee.update({ where: { id: employeeId }, data: { papersPending: pending } });
  return pending;
}

/** Creates the worker's paper rows from what the candidate's onboarding recorded, and sets "papers pending". */
export async function seedPapersFromCandidate(candidateId: string, employeeId: string, userId: string): Promise<void> {
  const candidate = await prisma.candidateOnboarding.findUnique({ where: { id: candidateId }, include: { history: true } });
  if (!candidate) return;
  const rows = seedPapers(candidate as unknown as Record<string, string>, candidate.history);
  await prisma.employeePaper.createMany({ data: rows.map((r) => ({ employeeId, item: r.item, status: r.status, statusDate: r.statusDate, referenceNo: r.referenceNo, expiryDate: r.expiryDate, updatedById: userId })), skipDuplicates: true });
  await refreshPapersPending(employeeId);
}
