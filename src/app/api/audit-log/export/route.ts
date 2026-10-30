import { NextResponse } from "next/server";
import { getCurrentUser, resolveSuperAdminBranchId, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/csvExport";
import { auditNames } from "@/lib/auditNames";
import { auditWhere, describeAuditQuery, parseAuditQuery } from "@/lib/auditFilters";
import { ACTIVITY_HEADERS, AUDIT_TIME_ZONE, FIELD_HEADERS, ACTION_WORD, buildAuditRows, countBy, uaeDateTime, type ExportEntry } from "@/lib/auditExport";
import { entityMeta } from "@/lib/auditPresentation";

export const maxDuration = 60;
const MAX_ROWS = 50_000;
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Admin-only export of the audit trail, for auditors and clients. An Excel workbook by default: a summary, one line per
// entry in plain words, and one line per changed field. CSV (one list) is there for other tools.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role === "STAFF") return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const isSuper = user.role === "SUPER_ADMIN";
  const branchId = isSuper ? await resolveSuperAdminBranchId() : user.branchId;
  const canSeePay = can(subjectOf(user), "payroll", "view");

  const url = new URL(request.url);
  const q = parseAuditQuery(url.searchParams);
  // Older links used `entity` for the record type.
  if (!q.entityType && url.searchParams.get("entity")) q.entityType = url.searchParams.get("entity")!.trim();
  if ((q.from && Number.isNaN(Date.parse(q.from))) || (q.to && Number.isNaN(Date.parse(q.to)))) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const where = await auditWhere(q, branchId);
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: MAX_ROWS }),
    prisma.auditLog.count({ where }),
  ]);
  const entries: ExportEntry[] = rows.map((r) => ({
    id: r.id, entityType: r.entityType, entityId: r.entityId, action: r.action, changes: r.changes as Record<string, unknown> | null,
    userName: r.userName, createdAt: r.createdAt, source: r.source, batchLabel: r.batchLabel, revertOfId: r.revertOfId, revertedAt: r.revertedAt, revertedByName: r.revertedByName,
  }));

  // Names are looked up a few thousand entries at a time, to keep each query small.
  const names: Record<string, string> = {};
  for (let i = 0; i < entries.length; i += 2000) Object.assign(names, await auditNames(entries.slice(i, i + 2000)));
  const { activity, fields } = buildAuditRows(entries, names, { canSeePay });
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const asText = (r: (string | number | Date | null)[]) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c));
    const wantFields = url.searchParams.get("sheet") === "fields";
    const csv = toCsv(wantFields ? FIELD_HEADERS : ACTIVITY_HEADERS, (wantFields ? fields : activity).map(asText));
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="audit-log-${wantFields ? "fields-" : ""}${stamp}.csv"`, "Cache-Control": "no-store" } });
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "ManpowerSync";
  wb.created = new Date();

  const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }) : null;
  const who = q.user ? (await prisma.user.findUnique({ where: { id: q.user }, select: { name: true } }))?.name : undefined;

  // --- Summary
  const sum = wb.addWorksheet("Summary", { views: [{ showGridLines: false }] });
  sum.columns = [{ width: 30 }, { width: 70 }];
  const title = sum.addRow(["Audit log"]); title.font = { bold: true, size: 16 };
  sum.addRow([branch?.name ?? "All companies"]).font = { size: 12, color: { argb: "FF555555" } };
  sum.addRow([]);
  const info = (label: string, value: string | number) => { const r = sum.addRow([label, value]); r.getCell(1).font = { bold: true }; r.getCell(2).alignment = { wrapText: true, vertical: "top" }; r.getCell(1).alignment = { vertical: "top" }; };
  info("Prepared", `${uaeDateTime(new Date())} by ${user.name}`);
  info("Entries in this file", entries.length);
  if (total > entries.length) info("Note", `There are ${total.toLocaleString("en-GB")} matching entries; the file holds the newest ${entries.length.toLocaleString("en-GB")}. Narrow the dates to see the rest.`);
  const filters = describeAuditQuery(q, { user: who });
  info("Filters", filters.length ? filters.join("\n") : "None: everything");
  if (entries.length) info("Period covered", `${uaeDateTime(entries[entries.length - 1].createdAt)} to ${uaeDateTime(entries[0].createdAt)}`);
  if (!canSeePay) info("Pay figures", "Not shown. Pay, allowance and bank changes need payroll access.");
  sum.addRow([]);
  const head = (t: string) => { const r = sum.addRow([t]); r.font = { bold: true, size: 12 }; };
  head("What each sheet holds");
  info("Activity", "One line per entry, in plain words: who did what, to which record, and when.");
  info("Field changes", "One line per field that changed, with the old and the new value. Filter by Record or Field to follow one thing.");
  sum.addRow([]);
  head("By action");
  for (const [a, n] of countBy(entries, (e) => ACTION_WORD[e.action] ?? e.action)) info(a, n);
  sum.addRow([]);
  head("By person (top 15)");
  for (const [p, n] of countBy(entries, (e) => e.userName).slice(0, 15)) info(p, n);
  sum.addRow([]);
  head("By area");
  for (const [m, n] of countBy(entries, (e) => entityMeta(e.entityType).module)) info(m, n);
  sum.addRow([]);
  info("About the times", `All dates and times are UAE time (${AUDIT_TIME_ZONE}, GMT+4).`);
  info("About old entries", "Entries from before the source was recorded show 'Screen (older entry)'.");

  const sheet = (name: string, headers: string[], data: (string | number | Date | null)[][], widths: number[], wrapCol?: number) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = headers.map((h, i) => ({ header: h, width: widths[i] }));
    const hr = ws.getRow(1);
    hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
    hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4B3FC8" } };
    hr.alignment = { vertical: "middle", wrapText: true };
    hr.height = 24;
    for (const r of data) ws.addRow(r);
    ws.getColumn(1).numFmt = "dd mmm yyyy";
    ws.getColumn(1).alignment = { horizontal: "left" };
    if (wrapCol) ws.getColumn(wrapCol).alignment = { wrapText: true, vertical: "top" };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    return ws;
  };
  sheet("Activity", ACTIVITY_HEADERS, activity, [13, 11, 20, 70, 11, 16, 20, 26, 9, 14, 24, 28, 34, 28], 4);
  sheet("Field changes", FIELD_HEADERS, fields, [13, 11, 20, 16, 20, 26, 11, 28, 30, 30, 28], undefined);

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    headers: { "Content-Type": XLSX, "Content-Disposition": `attachment; filename="audit-log-${stamp}.xlsx"`, "Cache-Control": "no-store" },
  });
}

