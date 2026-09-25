import { NextResponse } from "next/server";
import { getVendor } from "@/lib/vendor/session";
import { parseRange } from "@/lib/attendanceReport";
import { loadAttendanceReport } from "@/lib/vendorAttendanceReport";
import { attendanceReportPdf, attendanceReportXlsx } from "@/lib/generateAttendanceReport";

const LABEL = { ALL: "All statuses", PRESENT: "Present", ABSENT: "Absent", LEAVE: "On leave" } as const;

/** The signed-in supplier's own attendance report, as PDF or Excel. */
export async function GET(req: Request) {
  const vendor = await getVendor();
  if (!vendor) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const url = new URL(req.url);
  const parsed = parseRange({ from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined, status: url.searchParams.get("status") ?? undefined }, new Date());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";

  const { range } = parsed;
  const { rows } = await loadAttendanceReport(vendor.id, range);
  const meta = { supplier: vendor.fullName ?? vendor.name, from: range.from.toISOString().slice(0, 10), to: range.to.toISOString().slice(0, 10), statusLabel: LABEL[range.status] };
  const base = `attendance-${meta.from}-to-${meta.to}`;
  const body = format === "pdf" ? await attendanceReportPdf(meta, rows) : await attendanceReportXlsx(meta, rows);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
