import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/ownerServer";
import { PrintButton } from "./print-button";

export const metadata = { title: "Invoice" };

const aed = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function InvoicePage({ params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  await requireOwner();
  const { id, invoiceId } = await params;
  const inv = await prisma.customerInvoice.findFirst({ where: { id: invoiceId, customerId: id }, include: { customer: true, payments: { select: { amount: true } } } });
  if (!inv) notFound();
  const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-default bg-white p-10 text-sm text-neutral-800">
      <div className="flex items-start justify-between">
        <div><p className="text-xl font-semibold text-neutral-900">ManpowerSync</p><p className="text-xs text-neutral-500">sales@manpowersync.com</p></div>
        <div className="text-right"><p className="text-lg font-semibold text-neutral-900">Tax invoice</p><p className="text-xs text-neutral-500">{inv.number}</p>{inv.status === "VOID" && <p className="mt-1 text-xs font-semibold text-red-600">VOID</p>}{inv.status === "PAID" && <p className="mt-1 text-xs font-semibold text-emerald-600">PAID</p>}</div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div><p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Billed to</p><p className="font-medium text-neutral-900">{inv.customer.name}</p>{inv.customer.address && <p>{inv.customer.address}</p>}{inv.customer.trn && <p>TRN {inv.customer.trn}</p>}<p>{inv.customer.contactEmail}</p></div>
        <div className="text-right"><p>Issued {day(inv.issueDate)}</p><p>Due {day(inv.dueDate)}</p></div>
      </div>
      <table className="w-full border-t border-neutral-200">
        <thead><tr className="text-left text-xs text-neutral-500 uppercase"><th className="py-2">Description</th><th className="py-2 text-right">Amount (AED)</th></tr></thead>
        <tbody><tr className="border-t border-neutral-200"><td className="py-3">{inv.description}</td><td className="py-3 text-right">{aed(Number(inv.subtotal))}</td></tr></tbody>
        <tfoot>
          <tr className="border-t border-neutral-200"><td className="py-2 text-right text-neutral-500">VAT</td><td className="py-2 text-right">{aed(Number(inv.vat))}</td></tr>
          <tr><td className="py-2 text-right font-semibold">Total</td><td className="py-2 text-right font-semibold">{aed(Number(inv.total))}</td></tr>
          {paid > 0 && <tr><td className="py-1 text-right text-neutral-500">Received</td><td className="py-1 text-right">{aed(paid)}</td></tr>}
        </tfoot>
      </table>
      <div className="print:hidden"><PrintButton /></div>
    </div>
  );
}
