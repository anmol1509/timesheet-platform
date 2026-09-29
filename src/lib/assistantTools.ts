import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { can, type PermissionSubject } from "@/lib/permissions";
import { getEmployeeTypeCounts } from "@/lib/employeeTypeCounts";
import { getDocumentExpiryCounts } from "@/lib/documentExpiryCounts";
import { getEntityCounts } from "@/lib/entityCounts";
import { getRenewals, summarise } from "@/lib/renewals";

/**
 * Read-only tools My Assistant can call.
 *
 * Every tool is gated on the same module permission as the page that shows
 * the data, and scoped to the caller's active branch. Results are deliberately
 * thin — names, ids, trade, status and aggregate counts; no contact details,
 * document numbers, salaries or rates — so the assistant can point at a
 * record without becoming a second way to read it.
 */

export type ToolContext = { subject: PermissionSubject; branchId: string | null };
export type RecordLink = { href: string; label: string; group: string };
type ToolResult = { content: string; links?: RecordLink[] };

const LIMIT = 8;

export const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_records",
    description:
      "Find records by name or number so the user can open them. kind: employee (name, employee ID or trade), project (name or code), client (name or code), supplier (name or code), demand (request number, or client/project name). Returns up to 8 matches, each with an id and a page link.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["employee", "project", "client", "supplier", "demand"] },
        query: { type: "string", description: "Name, code or number to look for (2+ characters)" },
      },
      required: ["kind", "query"],
    },
  },
  {
    name: "get_stats",
    description:
      "Headline figures for the user's current branch. metric: workforce (headcount by status and type), document_expiry (documents expired / expiring within 30 days by category), business_partners (clients, suppliers, projects), demands (demand requests by status), deployment (workers deployed to a project vs on the bench, and headcount per project), attendance (today's attendance by status, plus this month's normal and overtime hours), timesheets (timesheet rows by status for a month), invoices (client invoices by status with totals, for a month or all time), camps (beds total / occupied / free per camp), renewals (documents expiring within `days` days, default 60, with the 8 most urgent names), onboarding (candidates by pipeline: ready to join, joined, in progress). `month` (YYYY-MM) applies to timesheets and invoices.",
    input_schema: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["workforce", "document_expiry", "business_partners", "demands", "deployment", "attendance", "timesheets", "invoices", "camps", "renewals", "onboarding"] },
        month: { type: "string", description: "YYYY-MM, for timesheets / invoices. Omit for the current month (invoices: omit for all time)." },
        days: { type: "number", description: "Look-ahead window in days for renewals (1-365)." },
      },
      required: ["metric"],
    },
  },
];

const KIND_MODULE = { employee: "workforce", project: "projects", client: "partners", supplier: "partners", demand: "demand" } as const;
const METRIC_MODULE = { workforce: "workforce", document_expiry: "workforce", business_partners: "partners", demands: "demand",
  deployment: "workforce", attendance: "timesheets", timesheets: "timesheets", invoices: "billing", camps: "facilities", renewals: "workforce", onboarding: "onboarding",
} as const;

const monthArg = (v: unknown) => (typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null);
const denied = (what: string): ToolResult => ({ content: `The user doesn't have access to ${what}. Say so and suggest asking an admin.` });
const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

async function searchRecords(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const kind = input.kind as keyof typeof KIND_MODULE;
  const q = typeof input.query === "string" ? input.query.trim().slice(0, 80) : "";
  if (!(kind in KIND_MODULE)) return { content: "Unknown kind." };
  if (q.length < 2) return { content: "Query too short." };
  if (!can(ctx.subject, KIND_MODULE[kind], "view")) return denied(`${kind} records`);
  const where = branchWhere(ctx.branchId);
  let links: RecordLink[] = [];
  let rows: object[] = [];

  if (kind === "employee") {
    const found = await prisma.employee.findMany({
      where: { ...where, OR: [{ name: contains(q) }, { employeeIdNo: contains(q) }, { trade: contains(q) }] },
      select: { id: true, name: true, employeeIdNo: true, trade: true, status: true },
      take: LIMIT,
    });
    rows = found;
    links = found.map((e) => ({ href: `/employees/${e.id}`, label: `${e.name} (${e.employeeIdNo})`, group: "Employee" }));
  } else if (kind === "project") {
    const found = await prisma.project.findMany({
      where: { ...where, OR: [{ name: contains(q) }, { code: contains(q) }] },
      select: { id: true, name: true, code: true },
      take: LIMIT,
    });
    rows = found;
    links = found.map((p) => ({ href: `/projects/${p.id}`, label: `${p.name} (${p.code})`, group: "Project" }));
  } else if (kind === "client") {
    const found = await prisma.client.findMany({
      where: { ...where, OR: [{ name: contains(q) }, { code: contains(q) }] },
      select: { id: true, name: true, code: true },
      take: LIMIT,
    });
    rows = found;
    links = found.map((c) => ({ href: `/clients/${c.id}`, label: c.name, group: "Client" }));
  } else if (kind === "supplier") {
    const found = await prisma.supplier.findMany({
      where: { ...where, OR: [{ name: contains(q) }, { code: contains(q) }] },
      select: { id: true, name: true, code: true },
      take: LIMIT,
    });
    rows = found;
    links = found.map((s) => ({ href: `/suppliers/${s.id}`, label: s.name, group: "Supplier" }));
  } else {
    const no = /^\D*(\d{1,9})$/.exec(q);
    const found = await prisma.demandRequest.findMany({
      where: {
        ...where,
        OR: [
          ...(no ? [{ requestNo: Number(no[1]) }] : []),
          { client: { name: contains(q) } },
          { project: { name: contains(q) } },
        ],
      },
      select: { id: true, requestNo: true, status: true, client: { select: { name: true } }, project: { select: { name: true } } },
      orderBy: { requestNo: "desc" },
      take: LIMIT,
    });
    rows = found;
    links = found.map((d) => ({ href: `/demand/${d.id}`, label: `Demand #${d.requestNo} · ${d.project.name}`, group: "Demand" }));
  }
  return { content: JSON.stringify({ count: rows.length, results: rows }), links };
}

async function getStats(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const metric = input.metric as keyof typeof METRIC_MODULE;
  if (!(metric in METRIC_MODULE)) return { content: "Unknown metric." };
  if (!can(ctx.subject, METRIC_MODULE[metric], "view")) return denied("those figures");
  let data: unknown;
  if (metric === "workforce") {
    const byStatus = await prisma.employee.groupBy({ by: ["status"], where: branchWhere(ctx.branchId), _count: { _all: true } });
    data = {
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      byType: await getEmployeeTypeCounts(ctx.branchId),
    };
  } else if (metric === "document_expiry") {
    data = await getDocumentExpiryCounts(ctx.branchId);
  } else if (metric === "business_partners") {
    data = await getEntityCounts(ctx.branchId);
  } else if (metric === "deployment") {
    const base = { ...branchWhere(ctx.branchId), active: true };
    const [deployed, bench, perProject] = await Promise.all([
      prisma.employee.count({ where: { ...base, projectId: { not: null } } }),
      prisma.employee.count({ where: { ...base, projectId: null } }),
      prisma.employee.groupBy({ by: ["projectId"], where: { ...base, projectId: { not: null } }, _count: { _all: true }, orderBy: { _count: { projectId: "desc" } }, take: 10 }),
    ]);
    const names = await prisma.project.findMany({ where: { id: { in: perProject.map((p) => p.projectId!) } }, select: { id: true, name: true } });
    const nm = new Map(names.map((n) => [n.id, n.name]));
    data = { deployedToProject: deployed, onBench: bench, topProjects: perProject.map((p) => ({ project: nm.get(p.projectId!) ?? "?", workers: p._count._all })) };
  } else if (metric === "attendance") {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const where = branchWhere(ctx.branchId);
    const [byStatus, hours] = await Promise.all([
      prisma.attendance.groupBy({ by: ["status"], where: { ...where, date: today }, _count: { _all: true } }),
      prisma.attendance.aggregate({ where: { ...where, date: { gte: monthStart } }, _sum: { normalHours: true, otHours: true } }),
    ]);
    data = {
      today: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      monthToDate: { normalHours: Math.round(hours._sum.normalHours ?? 0), overtimeHours: Math.round(hours._sum.otHours ?? 0) },
    };
  } else if (metric === "timesheets") {
    const month = monthArg(input.month) ?? new Date().toISOString().slice(0, 7);
    const rows = await prisma.timesheetEntry.groupBy({ by: ["status"], where: { ...branchWhere(ctx.branchId), month }, _count: { _all: true }, _sum: { totalHours: true } });
    data = { month, byStatus: Object.fromEntries(rows.map((r) => [r.status, { rows: r._count._all, hours: Math.round(r._sum.totalHours ?? 0) }])) };
  } else if (metric === "invoices") {
    const month = monthArg(input.month);
    const rows = await prisma.clientInvoice.groupBy({ by: ["status"], where: { ...branchWhere(ctx.branchId), ...(month ? { month } : {}) }, _count: { _all: true }, _sum: { totalAmount: true } });
    data = { period: month ?? "all time", currency: "AED", byStatus: Object.fromEntries(rows.map((r) => [r.status, { invoices: r._count._all, total: Math.round(r._sum.totalAmount ?? 0) }])) };
  } else if (metric === "camps") {
    const camps = await prisma.camp.findMany({ where: branchWhere(ctx.branchId), select: { name: true, rooms: { select: { beds: { select: { employeeId: true } } } } } });
    const per = camps.map((c) => {
      const beds = c.rooms.flatMap((r) => r.beds);
      const occupied = beds.filter((b) => b.employeeId).length;
      return { camp: c.name, beds: beds.length, occupied, free: beds.length - occupied };
    });
    data = { totals: { beds: per.reduce((a, c) => a + c.beds, 0), occupied: per.reduce((a, c) => a + c.occupied, 0) }, camps: per.slice(0, 15) };
  } else if (metric === "renewals") {
    const days = Math.min(365, Math.max(1, Math.round(Number(input.days) || 60)));
    const items = (await getRenewals(ctx.branchId, days)).filter((i) => i.days <= days);
    data = {
      withinDays: days,
      summary: summarise(items),
      mostUrgent: items.slice(0, 8).map((i) => ({ who: i.subjectName, document: i.document, expires: i.expiry.slice(0, 10), daysLeft: i.days })),
    };
  } else if (metric === "onboarding") {
    const where = branchWhere(ctx.branchId);
    const [total, ready, joined] = await Promise.all([
      prisma.candidateOnboarding.count({ where }),
      prisma.candidateOnboarding.count({ where: { ...where, readyToJoin: true, joined: false } }),
      prisma.candidateOnboarding.count({ where: { ...where, joined: true } }),
    ]);
    data = { total, readyToJoinNotYetJoined: ready, joined, inProgress: total - ready - joined };
  } else {
    const byStatus = await prisma.demandRequest.groupBy({ by: ["status"], where: branchWhere(ctx.branchId), _count: { _all: true } });
    data = { byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) };
  }
  return { content: JSON.stringify(data) };
}

export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolResult> {
  const args = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  try {
    if (name === "search_records") return await searchRecords(args, ctx);
    if (name === "get_stats") return await getStats(args, ctx);
    return { content: "Unknown tool." };
  } catch (err) {
    console.error("assistant tool failed", name, err);
    return { content: "That lookup failed. Tell the user to try the page directly." };
  }
}
