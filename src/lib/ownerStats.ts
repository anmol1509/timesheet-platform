import { prisma } from "@/lib/db";
import { monthKey, monthRange } from "@/lib/aiCredits";
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
  /** More about what they hold. Older customer apps do not send these yet, so each may be missing. */
  clients?: number;
  projects?: number;
  auditRows?: number;
  imports?: { done: number; waiting: number; failed: number };
  /** Database changes applied, and any that did not finish. */
  migrations?: { applied: number; unfinished: number };
  /** Size of the whole database in bytes (dedicated customers only), and its biggest tables. */
  db?: { bytes: number; tables: { name: string; bytes: number }[] };
  /** This month's AI tokens by model, for working out what Claude really cost. */
  aiTokens?: { model: string; input: number; output: number }[];
  /** Emails sent this month through the email service. */
  emailsSent?: number;
  /** Database connections open now, and the most the database allows. */
  connections?: { now: number; max: number };
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
  const extra = await collectExtra(scope, !branchIds);
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
    ...extra,
    suspended: branches.length > 0 && branches.every((b) => b.suspendedAt !== null),
    ai: { month: statuses[0]?.month ?? "", total, used: Math.round(used * 100) / 100, remaining: Math.max(0, Math.round((total - used) * 100) / 100), pct: total <= 0 ? 100 : Math.min(100, Math.round((used / total) * 100)), level: worst, allowance: branches.reduce((s, b) => s + b.aiMonthlyCredits, 0) },
  };
}

/** The extra figures. Each is optional so one failing read (or a database that forbids it) never hides the rest. */
export async function collectExtra(scope: { branchId?: { in: string[] } }, wholeDatabase: boolean): Promise<Partial<CustomerStats>> {
  const out: Partial<CustomerStats> = {};
  const attempt = async (fn: () => Promise<void>) => { try { await fn(); } catch { /* leave it out */ } };
  await Promise.all([
    attempt(async () => { out.clients = await prisma.client.count({ where: scope }); }),
    attempt(async () => { out.projects = await prisma.project.count({ where: scope }); }),
    attempt(async () => { out.auditRows = await prisma.auditLog.count({ where: scope }); }),
    attempt(async () => {
      const rows = await prisma.importBatch.groupBy({ by: ["status"], where: scope, _count: { _all: true } });
      const n = (...st: string[]) => rows.filter((r) => st.includes(r.status)).reduce((t, r) => t + r._count._all, 0);
      out.imports = { done: n("DONE"), waiting: n("PREVIEWED", "DRAFT", "RUNNING"), failed: n("FAILED") };
    }),
    attempt(async () => {
      const r = await prisma.$queryRaw<{ applied: bigint; unfinished: bigint }[]>`select count(*) filter (where finished_at is not null) as applied, count(*) filter (where finished_at is null and rolled_back_at is null) as unfinished from _prisma_migrations`;
      out.migrations = { applied: Number(r[0].applied), unfinished: Number(r[0].unfinished) };
    }),
    attempt(async () => {
      const { start, end } = monthRange(monthKey());
      const rows = await prisma.aiUsage.groupBy({ by: ["model"], where: { ...scope, createdAt: { gte: start, lt: end } }, _sum: { inputTokens: true, outputTokens: true } });
      out.aiTokens = rows.map((r) => ({ model: r.model, input: r._sum.inputTokens ?? 0, output: r._sum.outputTokens ?? 0 }));
    }),
    attempt(async () => { out.emailsSent = (await prisma.emailStat.findUnique({ where: { month: monthKey() } }))?.sent ?? 0; }),
    wholeDatabase ? attempt(async () => {
      const r = await prisma.$queryRaw<{ now: bigint; max: number }[]>`select (select count(*) from pg_stat_activity where datname = current_database()) as now, current_setting('max_connections')::int as max`;
      out.connections = { now: Number(r[0].now), max: r[0].max };
    }) : Promise.resolve(),
    // Only meaningful when this deployment holds one customer; a shared database holds many.
    wholeDatabase ? attempt(async () => {
      const total = await prisma.$queryRaw<{ bytes: bigint }[]>`select pg_database_size(current_database()) as bytes`;
      const top = await prisma.$queryRaw<{ name: string; bytes: bigint }[]>`select relname as name, pg_total_relation_size(c.oid) as bytes from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 2 desc limit 5`;
      out.db = { bytes: Number(total[0].bytes), tables: top.map((t) => ({ name: t.name, bytes: Number(t.bytes) })) };
    }) : Promise.resolve(),
  ]);
  return out;
}
