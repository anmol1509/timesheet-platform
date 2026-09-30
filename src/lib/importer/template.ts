import ExcelJS from "exceljs";
import { COUNTRIES } from "@/lib/countries";
import { TARGETS } from "./targets";
import type { FieldDef, ImportKind } from "./types";

// A blank workbook per kind that imports without any column matching: the
// headings are exactly ours, required ones are marked, there is an example
// sheet to copy from, a notes sheet, and dropdowns where the values are fixed.

const EXAMPLES: Record<Exclude<ImportKind, "TIMESHEETS">, Record<string, string>[]> = {
  SUPPLIERS: [
    { name: "Al Noor Manpower Supply", code: "SANMS", parent: "", fullName: "AL NOOR MANPOWER SUPPLY L.L.C", contactPerson: "Rashid Al Mansoori", contactPhone: "+971 50 123 4501", contactEmail: "rashid@alnoor.example", tradeLicenseNumber: "TL-123456", category: "Manpower supply", trn: "100123456700003" },
    { name: "Al Noor Site Services", code: "", parent: "Al Noor Manpower Supply", fullName: "", contactPerson: "", contactPhone: "", contactEmail: "", tradeLicenseNumber: "", category: "", trn: "" },
  ],
  CLIENTS: [
    { name: "Emaar Properties", code: "CEP", contactPerson: "Sara Ahmed", contactPhone: "+971 4 555 0100", contactEmail: "sara@client.example", trn: "100987654300003", tradeLicenseNumber: "TL-778899", billingAddress: "Downtown Dubai", paymentTerms: "30 days" },
  ],
  WORKERS: [
    { employeeIdNo: "AN-101", name: "Ravi Kumar", trade: "Carpenter", supplier: "Al Noor Manpower Supply", sponsor: "Al Noor Manpower Supply", nationality: "India", mobileNumber: "+971 50 111 2233", gender: "Male", dateOfBirth: "14/03/1990", joinDate: "01/02/2025", passportNumber: "N1234567", passportExpiry: "20/08/2028", emiratesId: "784-1990-1234567-1", emiratesIdExpiry: "15/06/2027", visaExpiry: "10/12/2026", laborCardNumber: "LC-55123", laborCardExpiry: "10/12/2026" },
    { employeeIdNo: "AN-102", name: "Ali Khan", trade: "Steel Fixer", supplier: "Al Noor Manpower Supply", sponsor: "", nationality: "Pakistan", mobileNumber: "", gender: "Male", dateOfBirth: "", joinDate: "", passportNumber: "", passportExpiry: "", emiratesId: "", emiratesIdExpiry: "", visaExpiry: "", laborCardNumber: "", laborCardExpiry: "" },
  ],
};

const HELP: Record<string, string> = {
  name: "As it should appear everywhere. Capitals and extra spaces don't matter; the same name won't be added twice.",
  code: "Optional. Leave blank and we'll make one from the name (e.g. Burj Al Aweer → SBAA).",
  parent: "Sub-suppliers only: the name of the main supplier. Leave blank for a main supplier.",
  employeeIdNo: "Your worker ID or code, e.g. TP103. Unique. Used to match the worker next time.",
  supplier: "The company that supplies the worker. Added automatically if it's new.",
  sponsor: "The visa-holding company, if different. Added automatically if it's new.",
  nationality: "The country (India, Nepal…). \"Indian\" or \"INDIA\" are understood too; regions like \"Asian\" are not.",
  gender: "Male or Female.",
  trade: "e.g. Carpenter, Steel Fixer. Matched to the trades you already have.",
};

function styleHeader(row: ExcelJS.Row, fields: FieldDef[]) {
  row.height = 22;
  row.eachCell((cell, i) => {
    const required = fields[i - 1]?.required;
    cell.font = { bold: true, color: { argb: required ? "FFFFFFFF" : "FF1F2937" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: required ? "FF5B47E0" : "FFEDEBFB" } };
    cell.alignment = { vertical: "middle" };
  });
}

export async function buildTemplate(kind: ImportKind, monthLabel = new Date()): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  if (kind === "TIMESHEETS") return buildTimesheetTemplate(wb, monthLabel);

  const fields = TARGETS[kind].fields;
  const main = wb.addWorksheet(TARGETS[kind].label);
  styleHeader(main.addRow(fields.map((f) => f.label)), fields);
  main.views = [{ state: "frozen", ySplit: 1 }];
  fields.forEach((f, i) => { main.getColumn(i + 1).width = Math.max(16, Math.min(34, f.label.length + 8)); });

  // Fixed-value dropdowns
  const genderIdx = fields.findIndex((f) => f.key === "gender");
  if (genderIdx >= 0) {
    for (let r = 2; r <= 1000; r++) main.getCell(r, genderIdx + 1).dataValidation = { type: "list", allowBlank: true, formulae: ['"Male,Female"'] };
  }
  const natIdx = fields.findIndex((f) => f.key === "nationality");
  if (natIdx >= 0) {
    const lists = wb.addWorksheet("Lists", { state: "hidden" });
    COUNTRIES.forEach((c, i) => { lists.getCell(i + 1, 1).value = c.name; });
    for (let r = 2; r <= 1000; r++) {
      main.getCell(r, natIdx + 1).dataValidation = {
        type: "list", allowBlank: true, formulae: [`Lists!$A$1:$A$${COUNTRIES.length}`], showErrorMessage: false,
      };
    }
  }

  const example = wb.addWorksheet("Example");
  styleHeader(example.addRow(fields.map((f) => f.label)), fields);
  for (const row of EXAMPLES[kind as Exclude<ImportKind, "TIMESHEETS">]) example.addRow(fields.map((f) => row[f.key] ?? ""));
  fields.forEach((f, i) => { example.getColumn(i + 1).width = Math.max(16, Math.min(34, f.label.length + 8)); });

  const notes = wb.addWorksheet("Notes");
  notes.addRow(["Column", "Required", "What to enter"]).font = { bold: true };
  for (const f of fields) notes.addRow([f.label, f.required ? "Yes" : "No", HELP[f.key] ?? (f.aliases?.length ? `Also understood as: ${f.aliases.slice(0, 4).join(", ")}.` : "")]);
  notes.addRow([]);
  notes.addRow(["Dates", "", "Write day/month/year, e.g. 25/12/2026, or a real Excel date."]);
  notes.addRow(["Tip", "", "Fill in the first sheet. You don't have to keep our headings — the importer matches yours — but these import without any matching."]);
  notes.getColumn(1).width = 26; notes.getColumn(2).width = 10; notes.getColumn(3).width = 90;

  wb.eachSheet((ws) => { if (ws.name === "Example") ws.properties.tabColor = { argb: "FF9CA3AF" }; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** The layout the timesheet reader expects: a tab named for the month, headings on row 1, real dates on row 2, one row per worker. */
async function buildTimesheetTemplate(wb: ExcelJS.Workbook, when: Date): Promise<Buffer> {
  const year = when.getFullYear(), month = when.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const name = `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month]} ${String(year).slice(2)}`;
  const ws = wb.addWorksheet(name);
  const lead = ["S. N.", "I. D. No", "EMPLOYEE NAME", "Nationality", "Sponsor", "Main Supplier", "Client Name", "Site", "Project", "TRADE", "Rate", "Pay Rate", "TOTAL"];
  const trailing = ["No. Of Absent", "Absent Deduction", "Invoice Value"];
  const head = ws.addRow([...lead, ...Array.from({ length: days }, () => ""), ...trailing]);
  const dates = ws.addRow([...lead.map(() => ""), ...Array.from({ length: days }, (_, d) => new Date(Date.UTC(year, month, d + 1))), ...trailing.map(() => "")]);
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEBFB" } }; });
  dates.eachCell((c, col) => { if (col > lead.length && col <= lead.length + days) { c.numFmt = "d"; c.font = { bold: true }; c.alignment = { horizontal: "center" }; } });
  ws.getColumn(8).width = 18; ws.getColumn(9).width = 16; ws.getColumn(3).width = 26; ws.getColumn(5).width = 24; ws.getColumn(6).width = 24; ws.getColumn(7).width = 22;
  for (let c = lead.length + 1; c <= lead.length + days; c++) ws.getColumn(c).width = 5;
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 2 }];

  // A filled-in copy showing each kind of day; ignored by the importer (its name isn't a month).
  const ex = wb.addWorksheet("Example");
  ex.addRow([...lead, ...Array.from({ length: days }, (_, d) => d + 1), ...trailing]).font = { bold: true };
  const sample = (n: number, id: string, name: string, nat: string, sponsor: string, supplier: string, client: string, site: string, project: string, trade: string, rate: number, pay: number, day: (d: number) => string | number) => ex.addRow([n, id, name, nat, sponsor, supplier, client, site, project, trade, rate, pay, "", ...Array.from({ length: days }, (_, d) => day(d + 1)), "", "", ""]);
  const weekday = (d: number) => new Date(Date.UTC(year, month, d)).getUTCDay();
  sample(1, "EMP-001", "Ravi Kumar", "India", "", "Your Company", "Client A", "Tower 1", "PRJ-001", "Carpenter", 12, 8, (d) => (weekday(d) === 5 ? "OFF" : d === 10 ? "A" : 10));
  sample(2, "EMP-002", "Sunil Thapa", "Nepal", "", "Your Company", "Client A", "Tower 1", "PRJ-001", "Painter", 11, 7.5, (d) => (weekday(d) === 5 ? "OFF" : d === 4 ? "L" : d === 20 ? "H" : 9));
  ex.getColumn(3).width = 22; ex.getColumn(6).width = 20;
  ex.properties.tabColor = { argb: "FF9CA3AF" };

  const notes = wb.addWorksheet("Notes");
  notes.addRow(["How to fill this in"]).font = { bold: true };
  for (const line of [
    "One tab per month, named like this one (\"Aug 26\"). Copy the tab for the next month and change its name and the dates on row 2.",
    "One row per worker. I. D. No, EMPLOYEE NAME and Main Supplier are needed; the rest is optional.",
    "In each day: the hours worked (10), A for absent, L / SL / SICK for leave, H for holiday, OFF for the weekly off.",
    "Sponsor is the company holding the worker's visa, if different from the Main Supplier.",
    "Project: the project's code or name exactly as it appears under Projects. It links the worker to that project (which marks them deployed) and puts their attendance on it. Leave blank to skip.",
    "Rate is what the client is billed per hour. Pay Rate is what the worker is paid per hour, used by payroll for hourly companies; it is only filled in where the worker has no pay rate yet.",
    "Every day you fill in also becomes an Attendance record (hours = present, A = absent, L = leave, H = holiday, OFF = weekly off). Days that already have attendance are left alone.",
    "Overtime and salaried (basic) pay are not set here: mark overtime under Attendance, and set basic salary on the worker or in the Workers import.",
    "After uploading, open the month's payroll draft and press Recalculate to pick the new hours up.",
    "Your own file doesn't have to look like this — the importer finds your columns — this is just the simplest layout.",
  ]) notes.addRow([line]);
  notes.getColumn(1).width = 120;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
