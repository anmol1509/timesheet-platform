import { prisma } from "@/lib/db";
import { loadCreditStatus, pendingCreditRequests } from "@/lib/aiCreditsServer";

/** What the owner's dashboard shows about one customer's workspace. Read from a customer's own database, or from this one for a company here. */
export type CustomerStats = {
  at: string;
  branches: number;
  users: number;
  employees: number;
  activeEmployees: number;
  payrollRuns: number;
  lastPayrollMonth: string | null;
  lastActiveAt: string | null;
  version: string | null;
  suspended: boolean;
  /** Requests for extra credits waiting for the owner. */
  requests?: { id: string; credits: number; reason: string | null; by: string | null; at: string }[];
  ai: { month: string; total: number; used: number; remaining: number; pct: number; level: string; allowance: number };
};

/** Totals for the given companies (or every company in this database when none are given). */
export async function collectStats(branchIds?: string[]): Promise<CustomerStats> {
  const branchWhere = branchIds ? { id: { in: branchIds } } : {};
  const scope = branchIds ? { branchId: { in: branchIds } } : {};
  const branches = await prisma.branch.findMany({ where: branchWhere, select: { id: true, aiMonthlyCredits: true, suspendedAt: true } });
  const ids = branches.map((b) => b.id);
  const [users, employees, activeEmployees, payrollRuns, lastRun, lastSeen] = await Promise.all([
    prisma.user.count({ where: { ...scope, isActive: true, role: { not: "SUPER_ADMIN" } } }),
    prisma.employee.count({ where: scope }),
    prisma.employee.count({ where: { ...scope, active: true } }),
    prisma.payrollRun.count({ where: scope }),
    prisma.payrollRun.findFirst({ where: scope, orderBy: { month: "desc" }, select: { month: true } }),
    prisma.userSession.aggregate({ where: { user: { ...scope, role: { not: "SUPER_ADMIN" } } }, _max: { lastSeenAt: true } }),
  ]);
  const statuses = await Promise.all(ids.map((id) => loadCreditStatus(id)));
  const requests = await pendingCreditRequests(branchIds);
  const total = statuses.reduce((s, x) => s + x.total, 0);
  const used = statuses.reduce((s, x) => s + x.used, 0);
  const worst = statuses.some((x) => x.level === "out") ? "out" : statuses.some((x) => x.level === "warn") ? "warn" : "ok";
  return {
    at: new Date().toISOString(),
    branches: branches.length,
    users,
    employees,
    activeEmployees,
    payrollRuns,
    lastPayrollMonth: lastRun?.month ?? null,
    lastActiveAt: lastSeen._max.lastSeenAt?.toISOString() ?? null,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    requests,
    suspended: branches.length > 0 && branches.every((b) => b.suspendedAt !== null),
    ai: { month: statuses[0]?.month ?? "", total, used: Math.round(used * 100) / 100, remaining: Math.max(0, Math.round((total - used) * 100) / 100), pct: total <= 0 ? 100 : Math.min(100, Math.round((used / total) * 100)), level: worst, allowance: branches.reduce((s, b) => s + b.aiMonthlyCredits, 0) },
  };
}
