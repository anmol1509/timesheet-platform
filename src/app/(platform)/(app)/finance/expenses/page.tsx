import { PageHeader } from "@/components/PageHeader";
import { Download, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { SummaryStrip } from "@/components/SummaryStrip";
import { ExpensesBoard } from "./expenses-board";

export const metadata = { title: "Expenses" };
const STATUSES = ["PENDING", "APPROVED", "REJECTED"];

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const { status = "" } = await searchParams;
  const subject = subjectOf(user);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [rows, projects, monthApproved, topUps, cashSpent, pending, owed] = await Promise.all([
    prisma.expense.findMany({
      where: { ...branchWhere(branchId), ...(STATUSES.includes(status) ? { status } : {}) },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 300,
      include: { submittedBy: { select: { name: true } }, project: { select: { name: true } } },
    }),
    prisma.project.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.expense.findMany({ where: { ...branchWhere(branchId), status: "APPROVED", date: { gte: monthStart } }, select: { amount: true, vatAmount: true } }),
    prisma.pettyCashTopUp.findMany({ where: branchWhere(branchId), select: { amount: true } }),
    prisma.expense.findMany({ where: { ...branchWhere(branchId), status: "APPROVED", paymentMethod: "CASH" }, select: { amount: true, vatAmount: true } }),
    prisma.expense.findMany({ where: { ...branchWhere(branchId), status: "PENDING" }, select: { amount: true, vatAmount: true } }),
    prisma.expense.findMany({ where: { ...branchWhere(branchId), status: "APPROVED", outOfPocket: true, reimbursedAt: null }, select: { amount: true, vatAmount: true } }),
  ]);
  const files = rows.length
    ? await prisma.attachment.findMany({
        where: { entityType: "EXPENSE", entityId: { in: rows.map((r) => r.id) } },
        select: { id: true, entityId: true, docType: true, filename: true, expiryDate: true, uploadedAt: true },
        orderBy: { uploadedAt: "desc" },
      })
    : [];
  const sum = (xs: { amount: unknown; vatAmount: unknown }[]) => xs.reduce((n, e) => n + Number(e.amount) + Number(e.vatAmount), 0);
  const money = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`;
  const petty = topUps.reduce((s, t) => s + Number(t.amount), 0) - sum(cashSpent);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Expenses" icon={Wallet} description={<>Costs submitted for approval. Approved expenses feed Accounting.</>} />
        {can(subject, "finance.expenses", "export") && <a href={`/api/finance/export?type=expenses${status ? `&status=${status}` : ""}`} className="btn btn-secondary"><Download className="h-4 w-4" aria-hidden /> CSV</a>}
      </div>
      <SummaryStrip
        cells={[
          { label: "Approved this month", value: money(sum(monthApproved)), sub: `${monthApproved.length} expense${monthApproved.length === 1 ? "" : "s"}` },
          { label: "Awaiting approval", value: money(sum(pending)), sub: `${pending.length} expense${pending.length === 1 ? "" : "s"}`, tone: pending.length ? "warning" : "default" },
          { label: "Petty cash on hand", value: money(petty), sub: petty < 0 ? "Needs a top-up" : "Budgets & petty cash", tone: petty < 0 ? "danger" : "default", href: "/finance/expenses/budgets" },
          { label: "Owed to staff", value: money(sum(owed)), sub: `${owed.length} out-of-pocket claim${owed.length === 1 ? "" : "s"}`, tone: owed.length ? "warning" : "default" },
        ]}
      />
      <ExpensesBoard
        status={status}
        filters={[{ k: "", l: "All" }, { k: "PENDING", l: "Pending", count: pending.length }, { k: "APPROVED", l: "Approved" }, { k: "REJECTED", l: "Rejected" }]}
        canCreate={can(subject, "finance.expenses", "create")}
        canApprove={can(subject, "finance.expenses", "approve")}
        canDelete={can(subject, "finance.expenses", "delete")}
        projects={projects}
        rows={rows.map((r) => ({
          id: r.id, date: r.date.toISOString().slice(0, 10), category: r.category, description: r.description,
          total: Number(r.amount) + Number(r.vatAmount), paidTo: r.paidTo, method: r.paymentMethod, project: r.project?.name ?? null,
          status: r.status, by: r.submittedBy.name, note: r.decisionNote,
          outOfPocket: r.outOfPocket, reimbursed: !!r.reimbursedAt, branchId: r.branchId,
          files: files.filter((f) => f.entityId === r.id).map((f) => ({ id: f.id, docType: f.docType, filename: f.filename, expiryDate: f.expiryDate ? f.expiryDate.toISOString() : null, uploadedAt: f.uploadedAt.toISOString() })),
        }))}
      />
    </div>
  );
}
