import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { billStatus, billTotals } from "@/lib/payables";
import { InvoicesBoard, type InvoiceRow } from "./invoices-board";

export const metadata = { title: "Invoices" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function VendorInvoicesPage() {
  const vendor = (await getVendor())!;
  const today = new Date();
  const bills = await prisma.supplierBill.findMany({
    where: { supplierId: vendor.id },
    orderBy: { billDate: "desc" },
    take: 200,
    include: { payments: { select: { amount: true, paidOn: true, method: true, reference: true }, orderBy: { paidOn: "desc" } } },
  });
  const files = bills.length
    ? await prisma.attachment.findMany({ where: { entityType: "SUPPLIER_BILL", entityId: { in: bills.map((b) => b.id) } }, select: { id: true, entityId: true, filename: true } })
    : [];

  const rows: InvoiceRow[] = bills.map((b) => {
    const t = billTotals({ amount: Number(b.amount), vatAmount: Number(b.vatAmount) }, b.payments.map((p) => ({ amount: Number(p.amount) })));
    return {
      id: b.id, billNo: b.billNo, billDate: day(b.billDate), dueDate: day(b.dueDate), periodMonth: b.periodMonth, description: b.description,
      amount: Number(b.amount), vatAmount: Number(b.vatAmount), ...t,
      approval: b.approvalStatus, approvalNote: b.approvalNote, paymentStatus: billStatus(t.balance, t.paid, b.dueDate, today),
      canResubmit: b.approvalStatus === "REJECTED" && b.payments.length === 0,
      payments: b.payments.map((p) => ({ paidOn: day(p.paidOn), amount: Number(p.amount), method: p.method, reference: p.reference })),
      files: files.filter((f) => f.entityId === b.id).map((f) => ({ id: f.id, filename: f.filename })),
    };
  });
  const approved = rows.filter((r) => r.approval === "APPROVED");
  const summary = {
    awaiting: rows.filter((r) => r.approval === "PENDING").length,
    rejected: rows.filter((r) => r.approval === "REJECTED").length,
    owed: approved.reduce((s, r) => s + r.balance, 0),
    paid: approved.reduce((s, r) => s + r.paid, 0),
  };

  return (
    <InvoicesBoard rows={rows} summary={summary} canSubmit={vendor.invoiceApprovalStatus === "Approved"} aedFormat={aed(summary.owed)} />
  );
}
