import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { can, type PermissionSubject } from "@/lib/permissions";
import { getEmployeeTypeCounts } from "@/lib/employeeTypeCounts";
import { getDocumentExpiryCounts } from "@/lib/documentExpiryCounts";
import { getEntityCounts } from "@/lib/entityCounts";

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
      "Headline counts for the user's current branch. metric: workforce (headcount by status and type), document_expiry (documents expired / expiring within 30 days by category), business_partners (clients, suppliers, projects), demands (demand requests by status).",
    input_schema: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["workforce", "document_expiry", "business_partners", "demands"] },
      },
      required: ["metric"],
    },
  },
];

const KIND_MODULE = { employee: "workforce", project: "projects", client: "partners", supplier: "partners", demand: "demand" } as const;
const METRIC_MODULE = { workforce: "workforce", document_expiry: "workforce", business_partners: "partners", demands: "demand" } as const;

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
