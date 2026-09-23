import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { LeaveBoard } from "./leave-board";

export const metadata = { title: "Leave requests" };

const FILTERS = [
  { key: "", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
];
const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function LeavePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const { status = "" } = await searchParams;
  const subject = subjectOf(user);
  const where = { ...branchWhere(branchId), ...(FILTERS.some((f) => f.key === status && f.key) ? { status } : {}) };

  const [requests, types, employees, pendingCount] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      take: 300,
      include: {
        employee: { select: { name: true, employeeIdNo: true } },
        leaveType: { select: { name: true, paid: true } },
        decidedBy: { select: { name: true } },
      },
    }),
    prisma.leaveType.findMany({ where: { ...branchWhere(branchId), isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), status: { not: "TERMINATED" } },
      orderBy: { name: "asc" },
      take: 2000,
      select: { id: true, name: true, employeeIdNo: true },
    }),
    prisma.leaveRequest.count({ where: { ...branchWhere(branchId), status: "PENDING" } }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Leave requests</h1>
        <p className="mt-1 text-sm text-muted">
          Raise, approve and track leave. {pendingCount > 0 ? `${pendingCount} waiting for a decision.` : "Nothing waiting for a decision."}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link
            key={f.key || "all"}
            href={f.key ? `/leave?status=${f.key}` : "/leave"}
            role="tab"
            aria-selected={status === f.key}
            className={status === f.key ? "rounded-md bg-brand-soft px-3 py-1.5 text-sm font-medium text-[var(--brand-primary)]" : "rounded-md px-3 py-1.5 text-sm text-secondary hover:bg-surface-hover"}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <LeaveBoard
        canApprove={can(subject, "leave", "approve")}
        canCreate={can(subject, "leave", "create")}
        employees={employees}
        types={types}
        rows={requests.map((r) => ({
          id: r.id,
          employeeName: r.employee.name,
          employeeIdNo: r.employee.employeeIdNo,
          typeName: r.leaveType.name,
          paid: r.leaveType.paid,
          start: day(r.startDate),
          end: day(r.endDate),
          days: r.days,
          reason: r.reason,
          status: r.status,
          decisionNote: r.decisionNote,
          decidedBy: r.decidedBy?.name ?? null,
        }))}
      />
    </div>
  );
}
