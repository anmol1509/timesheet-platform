import { prisma } from "@/lib/db";
import { approverIds } from "@/lib/notifications/notify";

/**
 * Whether someone other than `userId` could approve payroll in this branch.
 * Used to keep the person who prepared a payment from also approving it, without
 * locking out a small company where one person does both.
 */
export async function anotherApproverExists(branchId: string, userId: string): Promise<boolean> {
  return (await approverIds("payroll", branchId)).some((id) => id !== userId);
}

/**
 * Whether the person who prepared a run must not be the one to approve it. With an approval limit set,
 * that applies above the limit; with none set it applies whenever someone else is able to approve, so a
 * one-person company is never locked out but a team gets separation without configuring anything.
 */
export function needsSeparateApprover(threshold: number | null, total: number, anotherApprover: boolean): boolean {
  return threshold !== null ? total > threshold : anotherApprover;
}

/**
 * Employees whose pay for `month` is already approved or paid, mapped to that month. Attendance for these
 * days is frozen: changing it would no longer change what they were paid, only make the records disagree.
 */
export async function payrollLockedEmployees(employeeIds: string[], month: string): Promise<Set<string>> {
  if (employeeIds.length === 0) return new Set();
  const rows = await prisma.payrollLine.findMany({
    where: { employeeId: { in: employeeIds }, run: { month, status: { in: ["APPROVED", "PAID"] } } },
    select: { employeeId: true },
  });
  return new Set(rows.map((r) => r.employeeId));
}
