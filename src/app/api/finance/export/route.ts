import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { toCsv } from "@/lib/csvExport";
import { billStatus, billTotals } from "@/lib/payables";

export async function GET(request: Request) {
  const { user, branchId } = await requireUserWithBranch();
  if (!can(subjectOf(user), "finance", "export")) return NextResponse.json({ error: "You don't have permission to export finance data." }, { status: 403 });
  const q = new URL(request.url).searchParams;
  const stamp = new Date().toISOString().slice(0, 10);
  const n = (d: { toString(): string }) => Number(d.toString());

  if (q.get("type") === "bills") {
    const bills = await prisma.supplierBill.findMany({ where: branchWhere(branchId), orderBy: { dueDate: "asc" }, include: { supplier: { select: { name: true } }, payments: { select: { amount: true } } } });
    const today = new Date();
    const csv = toCsv(["Supplier", "Bill no", "Bill date", "Due date", "Amount", "VAT", "Total", "Paid", "Balance", "Status"],
      bills.map((b) => { const t = billTotals({ amount: n(b.amount), vatAmount: n(b.vatAmount) }, b.payments.map((p) => ({ amount: n(p.amount) }))); return [b.supplier.name, b.billNo, b.billDate.toISOString().slice(0, 10), b.dueDate.toISOString().slice(0, 10), n(b.amount), n(b.vatAmount), t.total, t.paid, t.balance, billStatus(t.balance, t.paid, b.dueDate, today)]; }));
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="supplier-bills-${stamp}.csv"`, "Cache-Control": "no-store" } });
  }
  const status = q.get("status");
  const rows = await prisma.expense.findMany({
    where: { ...branchWhere(branchId), ...(status && ["PENDING", "APPROVED", "REJECTED"].includes(status) ? { status } : {}) },
    orderBy: { date: "desc" },
    include: { submittedBy: { select: { name: true } }, project: { select: { name: true } } },
  });
  const csv = toCsv(["Date", "Category", "Description", "Amount", "VAT", "Total", "Paid to", "Method", "Reference", "Project", "Status", "Submitted by"],
    rows.map((e) => [e.date.toISOString().slice(0, 10), e.category, e.description, n(e.amount), n(e.vatAmount), n(e.amount) + n(e.vatAmount), e.paidTo, e.paymentMethod, e.reference, e.project?.name, e.status, e.submittedBy.name]));
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="expenses-${stamp}.csv"`, "Cache-Control": "no-store" } });
}
