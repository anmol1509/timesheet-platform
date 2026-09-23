/** Accounts-payable helpers — pure. */
const round2 = (n: number) => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;
const DAY = 86_400_000;

export type BillStatus = "PAID" | "PARTIAL" | "OVERDUE" | "UNPAID";

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  PAID: "Paid",
  PARTIAL: "Part-paid",
  OVERDUE: "Overdue",
  UNPAID: "Unpaid",
};

export function billTotals(b: { amount: number; vatAmount: number }, payments: { amount: number }[]) {
  const total = round2(b.amount + b.vatAmount);
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  return { total, paid, balance: round2(total - paid) };
}

export function billStatus(balance: number, paid: number, dueDate: Date, today: Date): BillStatus {
  if (balance <= 0) return "PAID";
  if (dueDate.getTime() < today.getTime()) return "OVERDUE";
  return paid > 0 ? "PARTIAL" : "UNPAID";
}

export const AGEING_BUCKETS = ["Not yet due", "1–30 days", "31–60 days", "61–90 days", "90+ days"] as const;

/** Which ageing bucket an unpaid balance falls in, by days past due. */
export function ageingBucket(dueDate: Date, today: Date): number {
  const late = Math.floor((today.getTime() - dueDate.getTime()) / DAY);
  if (late <= 0) return 0;
  if (late <= 30) return 1;
  if (late <= 60) return 2;
  if (late <= 90) return 3;
  return 4;
}
