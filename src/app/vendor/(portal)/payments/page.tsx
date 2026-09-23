import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { Badge, type BadgeColor } from "@/components/Badge";
import { BILL_STATUS_LABELS, billStatus, billTotals, type BillStatus } from "@/lib/payables";

export const metadata = { title: "Payments" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: Date) => d.toISOString().slice(0, 10);
const COLOR: Record<BillStatus, BadgeColor> = { PAID: "green", PARTIAL: "blue", OVERDUE: "red", UNPAID: "amber" };

export default async function VendorPaymentsPage() {
  const vendor = (await getVendor())!;
  const today = new Date();
  const bills = await prisma.supplierBill.findMany({
    where: { supplierId: vendor.id },
    orderBy: { billDate: "desc" },
    take: 100,
    include: { payments: { select: { amount: true, paidOn: true, method: true, reference: true }, orderBy: { paidOn: "desc" } } },
  });
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-primary">Payments</h1>
      <p className="-mt-3 text-sm text-muted">Bills we&apos;ve recorded for your company, and what has been paid.</p>
      {bills.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No bills recorded yet.</div>
      ) : (
        <ul className="card divide-y divide-[var(--border)]">
          {bills.map((b) => {
            const t = billTotals({ amount: Number(b.amount), vatAmount: Number(b.vatAmount) }, b.payments.map((p) => ({ amount: Number(p.amount) })));
            const st = billStatus(t.balance, t.paid, b.dueDate, today);
            return (
              <li key={b.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-primary">Bill {b.billNo}</span>
                  <Badge color={COLOR[st]} dot>{BILL_STATUS_LABELS[st]}</Badge>
                </div>
                <p className="text-xs text-muted">Dated {day(b.billDate)} · due {day(b.dueDate)}{b.description ? ` · ${b.description}` : ""}</p>
                <p className="tabular-nums text-secondary">Total AED {aed(t.total)} · paid AED {aed(t.paid)} · <span className="font-medium text-primary">balance AED {aed(t.balance)}</span></p>
                {b.payments.map((p, i) => (
                  <p key={i} className="text-xs text-muted">Paid AED {aed(Number(p.amount))} on {day(p.paidOn)}{p.method ? ` by ${p.method.toLowerCase()}` : ""}{p.reference ? ` (${p.reference})` : ""}</p>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
