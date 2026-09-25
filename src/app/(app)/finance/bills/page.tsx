import Link from "next/link";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { billStatus, billTotals } from "@/lib/payables";
import { billVariance } from "@/lib/financeRules";
import { BillsBoard, type BillRow } from "./bills-board";

export const metadata = { title: "Supplier bills" };
const FILTERS = [
  { k: "", l: "All" },
  { k: "REVIEW", l: "Awaiting approval" },
  { k: "OPEN", l: "Outstanding" },
  { k: "OVERDUE", l: "Overdue" },
  { k: "PAID", l: "Paid" },
];

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const { view = "" } = await searchParams;
  const subject = subjectOf(user);
  const today = new Date();
  const [bills, suppliers] = await Promise.all([
    prisma.supplierBill.findMany({
      where: branchWhere(branchId),
      orderBy: { dueDate: "asc" },
      take: 500,
      include: { supplier: { select: { name: true } }, payments: { select: { id: true, amount: true, paidOn: true, method: true, reference: true }, orderBy: { paidOn: "asc" } } },
    }),
    prisma.supplier.findMany({ where: { ...branchWhere(branchId), status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const files = bills.length
    ? await prisma.attachment.findMany({
        where: { entityType: "SUPPLIER_BILL", entityId: { in: bills.map((b) => b.id) } },
        select: { id: true, entityId: true, docType: true, filename: true, expiryDate: true, uploadedAt: true },
        orderBy: { uploadedAt: "desc" },
      })
    : [];

  const rows: BillRow[] = bills.map((b) => {
    const t = billTotals({ amount: Number(b.amount), vatAmount: Number(b.vatAmount) }, b.payments.map((p) => ({ amount: Number(p.amount) })));
    return {
      id: b.id, supplier: b.supplier.name, supplierId: b.supplierId, billNo: b.billNo,
      billDate: b.billDate.toISOString().slice(0, 10), dueDate: b.dueDate.toISOString().slice(0, 10),
      ...t, status: billStatus(t.balance, t.paid, b.dueDate, today), description: b.description, paymentCount: b.payments.length,
      approval: b.approvalStatus, approvalNote: b.approvalNote, viaPortal: b.submittedBySupplier, branchId: b.branchId, periodMonth: b.periodMonth,
      // Compared before VAT: the timesheet figure has no VAT in it.
      variance: b.timesheetAmount !== null ? { ...billVariance(Number(b.amount), Number(b.timesheetAmount)), reference: Number(b.timesheetAmount), hours: b.timesheetHours ?? 0, billAmount: Number(b.amount) } : null,
      payments: b.payments.map((p) => ({ id: p.id, paidOn: p.paidOn.toISOString().slice(0, 10), amount: Number(p.amount), method: p.method, reference: p.reference })),
      files: files.filter((f) => f.entityId === b.id).map((f) => ({ id: f.id, docType: f.docType, filename: f.filename, expiryDate: f.expiryDate ? f.expiryDate.toISOString() : null, uploadedAt: f.uploadedAt.toISOString() })),
    };
  });
  const shown = rows.filter((r) =>
    view === "OPEN" ? r.balance > 0 && r.approval !== "REJECTED" : view === "OVERDUE" ? r.status === "OVERDUE" : view === "PAID" ? r.status === "PAID" : view === "REVIEW" ? r.approval === "PENDING" : true
  );
  const reviewCount = rows.filter((r) => r.approval === "PENDING").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-xl font-semibold tracking-tight text-primary">Supplier bills</h1><p className="mt-1 text-sm text-muted">Bills are approved before they can be paid. Suppliers with portal access can see their own bills.</p></div>
        {can(subject, "finance", "export") && <a href="/api/finance/export?type=bills" className="btn btn-secondary"><Download className="h-4 w-4" aria-hidden /> CSV</a>}
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <Link key={f.k || "all"} href={f.k ? `/finance/bills?view=${f.k}` : "/finance/bills"} role="tab" aria-selected={view === f.k}
            className={view === f.k ? "rounded-md bg-brand-soft px-3 py-1.5 text-sm font-medium text-[var(--brand-primary)]" : "rounded-md px-3 py-1.5 text-sm text-secondary hover:bg-surface-hover"}>
            {f.l}{f.k === "REVIEW" && reviewCount > 0 && <span className="ml-1.5 rounded-full bg-[var(--warning-soft)] px-1.5 text-xs text-[var(--warning)]">{reviewCount}</span>}
          </Link>
        ))}
      </div>
      <BillsBoard
        rows={shown}
        suppliers={suppliers}
        canCreate={can(subject, "finance", "create")}
        canPay={can(subject, "finance", "edit")}
        canDelete={can(subject, "finance", "delete")}
      />
    </div>
  );
}
