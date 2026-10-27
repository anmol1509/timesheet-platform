import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithBranch } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { monthLabelFromKey } from "@/lib/timesheetSummary";
import { resolveIssuer } from "@/lib/issuer";
import { generateHoursReportPdf, generateHoursReportXlsx, type HoursRow } from "@/lib/generateHoursReport";

export const maxDuration = 60;

const bodySchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1).max(1000),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  show: z.object({ supplier: z.boolean(), project: z.boolean(), client: z.boolean() }),
  groupBySupplier: z.boolean().default(false),
  format: z.enum(["pdf", "xlsx"]).default("pdf"),
  /** The own company whose header and logo the PDF carries; absent or null = the branch's own details. */
  issuerId: z.string().max(80).nullish(),
});

/** One working-hours sheet for the picked employees, with optional supplier / project / client columns. */
export async function POST(request: Request) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { employeeIds, month, show, groupBySupplier, format, issuerId } = parsed.data;
  if (!branchId) return NextResponse.json({ error: "Sign in as a company administrator first." }, { status: 400 });

  const entries = await prisma.timesheetEntry.findMany({
    where: { branchId, month, employeeIdNo: { in: employeeIds }, status: { not: "REJECTED" } },
    include: { supplier: { select: { name: true } }, client: { select: { name: true } }, project: { select: { code: true } } },
  });
  if (entries.length === 0) return NextResponse.json({ error: "None of the selected employees have hours for this month." }, { status: 400 });

  const roster = await prisma.employee.findMany({
    where: { branchId, employeeIdNo: { in: entries.map((e) => e.employeeIdNo) } },
    select: { employeeIdNo: true, project: { select: { code: true } } },
  });
  const projectOf = new Map(roster.map((r) => [r.employeeIdNo, r.project?.code ?? null] as const));

  const [year, monthNo] = month.split("-").map(Number);
  const dayCount = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();

  // An employee can have more than one row in a month (different company or client): sum them day by day.
  const merged = new Map<string, HoursRow>();
  for (const e of entries) {
    const cells = (JSON.parse(e.dailyHours) as { value: string }[]).map((c) => String(c.value ?? ""));
    const key = `${e.employeeIdNo}|${e.supplierId}|${e.clientId ?? ""}`;
    const row: HoursRow = merged.get(key) ?? {
      employeeIdNo: e.employeeIdNo, name: e.employeeName, trade: e.trade || null,
      supplier: e.supplier.name, project: e.project?.code ?? projectOf.get(e.employeeIdNo) ?? null, client: e.client?.name ?? null,
      days: Array.from({ length: dayCount }, () => ""),
    };
    for (let i = 0; i < dayCount; i++) row.days[i] = row.days[i] || cells[i] || "";
    merged.set(key, row);
  }

  const issuer = await resolveIssuer({ branchId, isSuperAdmin, companyId: issuerId });
  if ("error" in issuer) return NextResponse.json({ error: issuer.error }, { status: 400 });
  const letterhead = issuer.letterhead;
  const input = { letterhead, monthLabel: monthLabelFromKey(month), dayCount, rows: [...merged.values()], show, groupBySupplier, preparedBy: user.name };
  const buffer = format === "xlsx" ? await generateHoursReportXlsx(input) : await generateHoursReportPdf(input);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="working-hours-${month}.${format}"`,
    },
  });
}
