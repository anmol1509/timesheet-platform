import { approverIds } from "@/lib/notifications/notify";

/**
 * Whether someone other than `userId` could approve payroll in this branch.
 * Used to keep the person who prepared a payment from also approving it, without
 * locking out a small company where one person does both.
 */
export async function anotherApproverExists(branchId: string, userId: string): Promise<boolean> {
  return (await approverIds("payroll", branchId)).some((id) => id !== userId);
}
