import Link from "next/link";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { ExpensesBoard } from "./expenses-board";

export const metadata = { title: "Expenses" };
const FILTERS = [{ k: "", l: "All" }, { k: "PENDING", l: "Pending" }, { k: "APPROVED", l: "Approved" }, { k: "REJECTED", l: "Rejected" }];

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const { status = "" } = await searchParams;
  const subject = subjectOf(user);
  const [rows, projects] = await Promise.all([
    prisma.expense.findMany({
      where: { ...branchWhere(branchId), ...(FILTERS.some((f) => f.k && f.k === status) ? { status } : {}) },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 300,
      include: { submittedBy: { select: { name: true } }, project: { select: { name: true } } },
    }),
    prisma.project.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">Expenses</h1>
          <p className="mt-1 text-sm text-muted">Costs submitted for approval. Approved expenses feed the finance overview.</p>
        </div>
        {can(subject, "finance", "export") && <a href={`/api/finance/export?type=expenses${status ? `&status=${status}` : ""}`} className="btn btn-secondary"><Download className="h-4 w-4" aria-hidden /> CSV</a>}
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link key={f.k || "all"} href={f.k ? `/finance/expenses?status=${f.k}` : "/finance/expenses"} role="tab" aria-selected={status === f.k}
            className={status === f.k ? "rounded-md bg-brand-soft px-3 py-1.5 text-sm font-medium text-[var(--brand-primary)]" : "rounded-md px-3 py-1.5 text-sm text-secondary hover:bg-surface-hover"}>{f.l}</Link>
        ))}
      </div>
      <ExpensesBoard
        canCreate={can(subject, "finance", "create")}
        canApprove={can(subject, "finance", "approve")}
        canDelete={can(subject, "finance", "delete")}
        projects={projects}
        rows={rows.map((r) => ({
          id: r.id, date: r.date.toISOString().slice(0, 10), category: r.category, description: r.description,
          total: Number(r.amount) + Number(r.vatAmount), paidTo: r.paidTo, method: r.paymentMethod, project: r.project?.name ?? null,
          status: r.status, by: r.submittedBy.name, note: r.decisionNote,
        }))}
      />
    </div>
  );
}
