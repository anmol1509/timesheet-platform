import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildLetterhead } from "@/lib/letterhead";
import { isTemplateKey } from "@/lib/timesheetTemplates";
import { generateTemplatedPdf, generateTemplatedXlsx } from "@/lib/generateTemplatedTimesheet";
import { generateTimesheetPdf, DEFAULT_TIMESHEET_NOTES } from "@/lib/generateTimesheetPdf";
import { generateSupplierXlsx } from "@/lib/generateXlsx";
import type { DailyHourCell } from "@/lib/parseTimesheet";

const WORKERS: [string, string, string, number, string][] = [
  ["S-001", "Sample Worker One", "Mason", 14, "P-101"],
  ["S-002", "Sample Worker Two", "Mason", 14, "P-101"],
  ["S-003", "Sample Worker Three", "Carpenter", 15, "P-101"],
  ["S-004", "Sample Worker Four", "Electrician", 18, "P-102"],
  ["S-005", "Sample Worker Five", "Helper", 10, "P-102"],
  ["S-006", "Sample Worker Six", "Helper", 10, "P-102"],
];

/** A sample of a layout with made-up workers, for the Templates tab. */
export async function GET(request: Request) {
  const { branchId } = await requireUserWithBranch();
  const url = new URL(request.url);
  const template = url.searchParams.get("template");
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";
  if (!isTemplateKey(template)) return NextResponse.json({ error: "Unknown template." }, { status: 400 });

  const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId } }) : null;
  const year = new Date().getUTCFullYear();
  const monthNo = new Date().getUTCMonth() || 12;
  const y = new Date().getUTCMonth() === 0 ? year - 1 : year;
  const days = new Date(Date.UTC(y, monthNo, 0)).getUTCDate();
  const monthLabel = new Date(Date.UTC(y, monthNo - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const dmy = (d: number) => `${String(d).padStart(2, "0")}/${String(monthNo).padStart(2, "0")}/${y}`;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const entries = WORKERS.map(([employeeIdNo, employeeName, trade, rate, projectCode], wi) => ({
    employeeIdNo, employeeName, trade, rate, projectCode,
    absentDeduction: wi === 3 ? 25 : 0,
    dailyHours: Array.from({ length: days }, (_, d): DailyHourCell => {
      const dt = new Date(Date.UTC(y, monthNo - 1, d + 1));
      const off = dt.getUTCDay() === 5;
      const absent = wi === 3 && d === 9;
      return { date: dt.toISOString().slice(0, 10), label: wd[dt.getUTCDay()], value: off ? "W" : absent ? "A" : String(wi % 2 ? 10 : 9) };
    }),
  }));
  const letterhead = await buildLetterhead({
    name: branch?.name ?? "Your Company", address: branch?.address ?? null, emirate: branch?.emirate ?? null, country: branch?.country ?? null,
    phone: branch?.phone ?? null, fax: branch?.fax ?? null, email: branch?.email ?? null, poBox: branch?.poBox ?? null, trn: branch?.trn ?? null,
  });
  const common = { letterhead, subContractor: "Sample Manpower Supply LLC", periodFrom: dmy(1), periodTo: dmy(days), entries };
  let buffer: Buffer;
  if (template === "standard") {
    buffer = format === "xlsx"
      ? await generateSupplierXlsx({ fullName: common.subContractor, monthLabel, issuedTo: letterhead.name, gasDeduction: 30, entries })
      : await generateTimesheetPdf({ ...common, subContractorCode: null, additions: 0, safetyDeduction: 30, otherDeduction: 0, vatPercent: 5, preparedBy: "Sample", preparedByRole: null, verifiedBy: null, verifiedByRole: null, approvedBy: null, approvedByRole: null, notes: DEFAULT_TIMESHEET_NOTES });
  } else {
    const input = { ...common, template, monthLabel, issuedTo: letterhead.name, gasDeduction: 30, vatPercent: 5, preparedBy: "Sample" };
    buffer = format === "xlsx" ? await generateTemplatedXlsx(input) : await generateTemplatedPdf(input);
  }
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="sample-${template}.${format}"`,
    },
  });
}
