import { buildLetterhead } from "@/lib/letterhead";
import type { TimesheetTemplateKey } from "@/lib/timesheetTemplates";
import { generateTemplatedPdf, generateTemplatedXlsx } from "@/lib/generateTemplatedTimesheet";
import { generateTimesheetPdf } from "@/lib/generateTimesheetPdf";
import { generateSupplierXlsx } from "@/lib/generateXlsx";
import type { DailyHourCell } from "@/lib/parseTimesheet";
import { maskLetterhead, standardExtras } from "@/lib/timesheetTemplateApply";
import type { TemplateConfig } from "@/lib/timesheetTemplateConfig";
import type { Branch } from "@/generated/prisma/client";

const WORKERS: [string, string, string, number, string][] = [
  ["S-001", "Sample Worker One", "Mason", 14, "P-101"],
  ["S-002", "Sample Worker Two", "Mason", 14, "P-101"],
  ["S-003", "Sample Worker Three", "Carpenter", 15, "P-101"],
  ["S-004", "Sample Worker Four", "Electrician", 18, "P-102"],
  ["S-005", "Sample Worker Five", "Helper", 10, "P-102"],
  ["S-006", "Sample Worker Six", "Helper", 10, "P-102"],
];

/** A sample sheet of a layout with made-up workers, optionally with a company's own template applied. */
export async function renderSample(template: TimesheetTemplateKey, config: TemplateConfig | null, format: "pdf" | "xlsx", branch: Branch | null): Promise<Buffer> {
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
    phone: branch?.phone ?? null, fax: branch?.fax ?? null, email: branch?.email ?? null, poBox: branch?.poBox ?? null, trn: branch?.trn ?? null, logoId: branch?.logoId ?? null,
  });
  const common = { letterhead, subContractor: "Sample Manpower Supply LLC", periodFrom: dmy(1), periodTo: dmy(days), entries };
  let buffer: Buffer;
  if (template === "standard") {
    buffer = format === "xlsx"
      ? await generateSupplierXlsx({ fullName: common.subContractor, monthLabel, issuedTo: letterhead.name, gasDeduction: 30, entries, titleText: config?.title || undefined })
      : await generateTimesheetPdf({ ...common, letterhead: maskLetterhead(letterhead, config), subContractorCode: null, additions: 0, safetyDeduction: 30, otherDeduction: 0, preparedBy: "Sample", preparedByRole: null, verifiedBy: null, verifiedByRole: null, approvedBy: null, approvedByRole: null, ...standardExtras(config, 5) });
  } else {
    const input = { ...common, template, config, monthLabel, issuedTo: letterhead.name, gasDeduction: 30, vatPercent: 5, preparedBy: "Sample" };
    buffer = format === "xlsx" ? await generateTemplatedXlsx(input) : await generateTemplatedPdf(input);
  }
  return buffer;
}
