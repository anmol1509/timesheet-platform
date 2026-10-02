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
 * thin — names, ids, trade, status and counts; no contact details or document
 * numbers — so the assistant can point at a record without becoming a second
 * way to read it. The one exception is explain_payroll_line, which shows a
 * worker's pay breakdown and is available only to people with payroll access.
 */

export type ToolContext = { subject: PermissionSubject; branchId: string | null };
export type RecordLink = { href: string; label: string; group: string };
export type AssistantTable = { title: string; columns: string[]; rows: string[][]; total: number };
type ToolResult = { content: string; links?: RecordLink[]; table?: AssistantTable };

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
  {
    name: "list_rows",
    description:
      "A table of rows the user can read in the chat (the app shows it; do not repeat the rows in your answer, just say what it shows and the total). kind: absent_today (workers marked absent today), expiring_documents (visa/ID/passport/labour card etc. expiring within `days`, default 30), timesheet_status (every supplier's timesheet progress for `month`, including suppliers with none received), unpaid_invoices (sent or overdue client invoices), approved_not_invoiced (client-approved timesheets not yet invoiced, by client and month, with their value in AED — money waiting to be billed), idle_workers (workers on the bench).",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["absent_today", "expiring_documents", "timesheet_status", "unpaid_invoices", "approved_not_invoiced", "idle_workers"] },
        month: { type: "string", description: "YYYY-MM, for timesheet_status. Omit for the current month." },
        days: { type: "number", description: "Look-ahead window in days for expiring_documents (1-365)." },
      },
      required: ["kind"],
    },
  },
  {
    name: "explain_payroll_line",
    description:
      "One worker's pay line from a payroll run, broken into its parts (days, hours, basic, allowances, overtime, deductions, gas, loan recovery, adjustments, net), so you can explain why the net is what it is. Needs payroll access. Use the pay rules in the system prompt to explain; never recalculate or guess.",
    input_schema: {
      type: "object",
      properties: {
        employee: { type: "string", description: "Worker name or employee ID (2+ characters)" },
        month: { type: "string", description: "YYYY-MM. Omit for the most recent run that includes this worker." },
      },
      required: ["employee"],
    },
  },
  {
    name: "draft_letter",
    description:
      "Open the Letters screen with a worker and letter already chosen, so the user can review and issue it. Only for employees of the user's own company. letter: a word from the letter's name, e.g. salary, experience, employment, warning, leave. This does not issue anything.",
    input_schema: {
      type: "object",
      properties: {
        employee: { type: "string", description: "Worker name or employee ID (2+ characters)" },
        letter: { type: "string", description: "Part of the letter template's name, e.g. salary" },
      },
      required: ["employee", "letter"],
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


const ROW_CAP = 25;
const aed = (n: number) => Math.round(n).toLocaleString("en-US");
const day = (d: Date) => d.toISOString().slice(0, 10);

const LIST_MODULE = {
  absent_today: "timesheets", expiring_documents: "workforce", timesheet_status: "timesheets",
  unpaid_invoices: "billing", approved_not_invoiced: "billing", idle_workers: "workforce",
} as const;

async function listRows(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const kind = input.kind as keyof typeof LIST_MODULE;
  if (!(kind in LIST_MODULE)) return { content: "Unknown kind." };
  if (!can(ctx.subject, LIST_MODULE[kind], "view")) return denied("those figures");
  const where = branchWhere(ctx.branchId);
  let table: AssistantTable;

  if (kind === "absent_today") {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const rows = await prisma.attendance.findMany({
      where: { ...where, date: today, status: "ABSENT" },
      select: { employee: { select: { name: true, employeeIdNo: true, trade: true } }, project: { select: { name: true } } },
      orderBy: { employee: { name: "asc" } },
    });
    table = { title: `Absent today (${day(today)})`, columns: ["Name", "ID", "Trade", "Project"], total: rows.length, rows: rows.slice(0, ROW_CAP).map((r) => [r.employee.name, r.employee.employeeIdNo, r.employee.trade ?? "", r.project?.name ?? ""]) };
  } else if (kind === "expiring_documents") {
    const days = Math.min(365, Math.max(1, Math.round(Number(input.days) || 30)));
    const items = (await getRenewals(ctx.branchId, days)).filter((i) => i.days <= days);
    table = { title: `Documents expiring within ${days} days`, columns: ["Who", "Document", "Expires", "Days left"], total: items.length, rows: items.slice(0, ROW_CAP).map((i) => [i.subjectName, i.document, i.expiry.slice(0, 10), String(i.days)]) };
  } else if (kind === "timesheet_status") {
    const month = monthArg(input.month) ?? new Date().toISOString().slice(0, 7);
    const [entries, suppliers] = await Promise.all([
      prisma.timesheetEntry.groupBy({ by: ["supplierId", "status"], where: { ...where, month }, _count: { _all: true }, _sum: { totalHours: true } }),
      prisma.supplier.findMany({ where: { ...where, status: "ACTIVE", employees: { some: { active: true } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    const by = new Map<string, { workers: number; hours: number; statuses: string[] }>();
    for (const e of entries) {
      const cur = by.get(e.supplierId) ?? { workers: 0, hours: 0, statuses: [] };
      cur.workers += e._count._all; cur.hours += e._sum.totalHours ?? 0; cur.statuses.push(`${e._count._all} ${e.status.toLowerCase().replace(/_/g, " ")}`);
      by.set(e.supplierId, cur);
    }
    const rows = suppliers.map((sp) => { const c = by.get(sp.id); return c ? [sp.name, String(c.workers), aed(c.hours), c.statuses.join(", ")] : [sp.name, "0", "0", "None received"]; });
    // Suppliers with nothing in yet first: they are what the user is usually after.
    rows.sort((a, b) => Number(a[1] !== "0") - Number(b[1] !== "0"));
    table = { title: `Timesheets for ${month}`, columns: ["Supplier", "Workers", "Hours", "Status"], total: rows.length, rows: rows.slice(0, ROW_CAP) };
  } else if (kind === "unpaid_invoices") {
    const now = Date.now();
    const found = await prisma.clientInvoice.findMany({ where: { ...where, status: { in: ["SENT", "OVERDUE"] } }, include: { client: { select: { name: true } } }, orderBy: { issueDate: "asc" } });
    table = {
      title: "Unpaid invoices", columns: ["Invoice", "Client", "Month", "Total (AED)", "Due", "Days overdue"], total: found.length,
      rows: found.slice(0, ROW_CAP).map((i) => [i.invoiceNumber, i.client.name, i.monthLabel, aed(i.totalAmount), i.dueDate ? day(i.dueDate) : "", i.dueDate && i.dueDate.getTime() < now ? String(Math.floor((now - i.dueDate.getTime()) / 86_400_000)) : "0"]),
    };
  } else if (kind === "approved_not_invoiced") {
    const groups = await prisma.timesheetEntry.groupBy({ by: ["clientId", "month"], where: { ...where, status: "CLIENT_APPROVED" }, _count: { _all: true }, _sum: { totalHours: true, invoiceValue: true }, orderBy: { month: "asc" } });
    const names = await prisma.client.findMany({ where: { id: { in: groups.map((g) => g.clientId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    const nm = new Map(names.map((n) => [n.id, n.name]));
    const value = groups.reduce((a, g) => a + (g._sum.invoiceValue ?? 0), 0);
    table = {
      title: `Approved by clients but not invoiced — AED ${aed(value)} waiting to be billed`, columns: ["Client", "Month", "Workers", "Hours", "Value (AED)"], total: groups.length,
      rows: groups.slice(0, ROW_CAP).map((g) => [g.clientId ? nm.get(g.clientId) ?? "?" : "No client set", g.month, String(g._count._all), aed(g._sum.totalHours ?? 0), aed(g._sum.invoiceValue ?? 0)]),
    };
  } else {
    const found = await prisma.employee.findMany({ where: { ...where, active: true, status: "IDLE" }, select: { name: true, employeeIdNo: true, trade: true, nationality: true }, orderBy: { name: "asc" } });
    table = { title: "Workers on the bench", columns: ["Name", "ID", "Trade", "Nationality"], total: found.length, rows: found.slice(0, ROW_CAP).map((e) => [e.name, e.employeeIdNo, e.trade ?? "", e.nationality ?? ""]) };
  }
  const note = table.total > table.rows.length ? ` Showing the first ${table.rows.length} of ${table.total}.` : "";
  return { content: JSON.stringify({ shownToUser: true, title: table.title, total: table.total, shown: table.rows.length }) + note, table };
}

async function explainPayrollLine(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  if (!can(ctx.subject, "payroll", "view")) return denied("payroll");
  const q = typeof input.employee === "string" ? input.employee.trim().slice(0, 80) : "";
  if (q.length < 2) return { content: "Query too short." };
  const month = monthArg(input.month);
  const lines = await prisma.payrollLine.findMany({
    where: { run: { ...branchWhere(ctx.branchId), ...(month ? { month } : {}) }, employee: { OR: [{ name: contains(q) }, { employeeIdNo: contains(q) }] } },
    include: { run: { select: { id: true, month: true, status: true, payType: true } }, employee: { select: { id: true, name: true, employeeIdNo: true } } },
    orderBy: { run: { month: "desc" } },
    take: 3,
  });
  if (lines.length === 0) return { content: "No pay line found for that worker." };
  const who = new Set(lines.map((l) => l.employeeId));
  if (who.size > 1) return { content: JSON.stringify({ ambiguous: true, matches: [...new Map(lines.map((l) => [l.employeeId, `${l.employee.name} (${l.employee.employeeIdNo})`])).values()] }) + " Ask which one." };
  const l = lines[0];
  const n = (d: unknown) => Number(d);
  const data = {
    worker: `${l.employee.name} (${l.employee.employeeIdNo})`, month: l.run.month, runStatus: l.run.status, payStructure: l.payStructure, companyPayType: l.run.payType, currency: "AED",
    daysInMonth: l.daysInMonth, absentDays: l.absentDays, unpaidLeaveDays: l.unpaidLeaveDays, idleDays: l.idleDays, sickDays: l.sickDays,
    normalHours: l.normalHours, overtimeHours: l.otHours, restDayHours: l.restHours, timesheetHours: l.timesheetHours,
    basicOrFlat: n(l.basic), allowances: n(l.allowances), overtimePay: n(l.overtimePay), absenceAndUnpaidLeaveDeductions: n(l.deductions),
    gasCharge: n(l.gasCharge), loanRecovery: n(l.loanDeduction), recurringEarnings: n(l.otherEarnings), recurringDeductions: n(l.otherDeductions),
    manualDeduction: n(l.manualDeduction), manualDeductionNote: l.deductionNote, adjustment: n(l.adjustment), adjustmentNote: l.adjustmentNote, net: n(l.net),
  };
  return { content: JSON.stringify(data), links: [{ href: `/payroll/${l.run.id}`, label: `Payroll ${l.run.month}`, group: "Payroll" }] };
}

async function draftLetter(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  if (!can(ctx.subject, "workforce", "create")) return denied("employee letters");
  const q = typeof input.employee === "string" ? input.employee.trim().slice(0, 80) : "";
  const word = typeof input.letter === "string" ? input.letter.trim().slice(0, 40) : "";
  if (q.length < 2 || word.length < 2) return { content: "Need a worker and a letter name." };
  const where = branchWhere(ctx.branchId);
  const [emps, templates] = await Promise.all([
    prisma.employee.findMany({ where: { ...where, status: { not: "TERMINATED" }, supplier: { isOwnCompany: true }, OR: [{ name: contains(q) }, { employeeIdNo: contains(q) }] }, select: { id: true, name: true, employeeIdNo: true }, take: 4 }),
    prisma.letterTemplate.findMany({ where: { ...where, audience: "EMPLOYEE", name: contains(word) }, select: { name: true }, take: 3 }),
  ]);
  if (emps.length === 0) return { content: "No employee of the user's own company matches that name." };
  if (emps.length > 1) return { content: JSON.stringify({ ambiguous: true, matches: emps.map((e) => `${e.name} (${e.employeeIdNo})`) }) + " Ask which one." };
  if (templates.length === 0) return { content: "No employee letter template has that name. Letters › Templates lists them." };
  const e = emps[0];
  const t = templates[0];
  return {
    content: JSON.stringify({ worker: `${e.name} (${e.employeeIdNo})`, letter: t.name, note: "Opens the Letters screen with both chosen. Nothing is issued until the user clicks Issue." }),
    links: [{ href: `/letters?employee=${e.id}&template=${encodeURIComponent(t.name)}`, label: `${t.name} for ${e.name}`, group: "Letters" }],
  };
}

export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolResult> {
  const args = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  try {
    if (name === "search_records") return await searchRecords(args, ctx);
    if (name === "get_stats") return await getStats(args, ctx);
    if (name === "list_rows") return await listRows(args, ctx);
    if (name === "explain_payroll_line") return await explainPayrollLine(args, ctx);
    if (name === "draft_letter") return await draftLetter(args, ctx);
    return { content: "Unknown tool." };
  } catch (err) {
    console.error("assistant tool failed", name, err);
    return { content: "That lookup failed. Tell the user to try the page directly." };
  }
}
