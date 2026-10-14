import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { billTotals } from "@/lib/payables";
import { PrintButton } from "./print-button";

export const metadata = { title: "Supplier statement" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Line = { date: Date; text: string; debit: number; credit: number };

/** A supplier's account: what we were billed, what we settled, and the running balance. Printable. */
export default async function StatementPage({ params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true, name: true, branchId: true } });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) notFound();
  const bills = await prisma.supplierBill.findMany({
    where: { supplierId, approvalStatus: "APPROVED" },
    include: { payments: { orderBy: { paidOn: "asc" } } },
    orderBy: { billDate: "asc" },
  });

  const lines: Line[] = bills.flatMap((b) => [
    { date: b.billDate, text: `Bill #${b.billNo}${b.description ? ` — ${b.description}` : ""}`, debit: Number(b.amount) + Number(b.vatAmount), credit: 0 },
    ...b.payments.map((p) => ({ date: p.paidOn, text: `${p.method === "CREDIT" ? "Credit" : "Payment"} · #${b.billNo}${p.reference ? ` · ${p.reference}` : ""}`, debit: 0, credit: Number(p.amount) })),
  ]).sort((a, b) => a.date.getTime() - b.date.getTime());

  const withBalance = lines.map((l, i) => ({
    ...l,
    balance: lines.slice(0, i + 1).reduce((sum, x) => sum + x.debit - x.credit, 0),
  }));
  const owed = bills.reduce((s, b) => s + billTotals({ amount: Number(b.amount), vatAmount: Number(b.vatAmount) }, b.payments.map((p) => ({ amount: Number(p.amount) }))).balance, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/finance/bills/ageing" className="text-xs text-muted hover:text-secondary">← Ageing</Link>
        <PrintButton />
      </div>
      <div className="card p-6 print:border-0 print:shadow-none">
        <h1 className="text-xl font-semibold tracking-tight text-primary">Statement of account</h1>
        <p className="mt-1 text-sm text-secondary">{supplier.name}</p>
        <p className="text-xs text-muted">As at {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</p>

        {withBalance.length === 0 ? (
          <p className="mt-6 text-sm text-muted">No approved bills for this supplier.</p>
        ) : (
          <table className="mt-6 w-full text-sm">
            <thead className="border-b border-default text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr><th className="py-2">Date</th><th className="py-2">Details</th><th className="py-2 text-right">Billed</th><th className="py-2 text-right">Paid / credited</th><th className="py-2 text-right">Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {withBalance.map((l, i) => (
                <tr key={i}>
                  <td className="py-2 whitespace-nowrap text-secondary">{l.date.toISOString().slice(0, 10)}</td>
                  <td className="py-2 text-secondary">{l.text}</td>
                  <td className="py-2 text-right tabular-nums">{l.debit ? aed(l.debit) : ""}</td>
                  <td className="py-2 text-right tabular-nums">{l.credit ? aed(l.credit) : ""}</td>
                  <td className="py-2 text-right tabular-nums text-primary">{aed(l.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-6 flex justify-between border-t border-default pt-3 text-sm font-semibold text-primary"><span>Balance due</span><span className="tabular">AED {aed(owed)}</span></p>
      </div>
    </div>
  );
}
