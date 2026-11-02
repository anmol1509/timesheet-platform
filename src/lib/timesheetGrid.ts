import { cleanDayValue } from "@/lib/timesheetRead";

/** The bulk timesheet as a file: one row per worker, the details first and then one column per day of the month. */
export const GRID_DETAIL_HEADERS = ["ID No", "Employee Name", "Trade", "Cost Rate", "Supplier", "Client"] as const;

export type GridRow = { employeeIdNo: string; employeeName: string; trade: string; rate: string; supplierName: string; clientName: string; days: string[] };

export function gridHeaders(dayCount: number): string[] {
  return [...GRID_DETAIL_HEADERS, ...Array.from({ length: dayCount }, (_, i) => String(i + 1))];
}

export function gridToCells(rows: GridRow[], dayCount: number): string[][] {
  return rows.map((r) => [r.employeeIdNo, r.employeeName, r.trade, r.rate, r.supplierName, r.clientName, ...Array.from({ length: dayCount }, (_, i) => r.days[i] ?? "")]);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ALIASES: Record<(typeof GRID_DETAIL_HEADERS)[number], string[]> = {
  "ID No": ["id no", "id", "employee id", "employee code", "emp id", "emp code", "code", "worker id", "staff id"],
  "Employee Name": ["employee name", "name", "worker name", "emp name", "full name"],
  Trade: ["trade", "designation", "position", "profession"],
  "Cost Rate": ["cost rate", "rate", "hourly rate", "rate per hour"],
  Supplier: ["supplier", "supplier name", "company", "employer"],
  Client: ["client", "client name"],
};

export type ParsedGrid = { rows: GridRow[]; ignoredDays: number; missingColumns: string[] };

/**
 * Turns the rows of an imported file (header → text) into grid rows. Headers are matched loosely; a day column is a header
 * that is just a number 1–31 (or "Day 5"). Cell values are cleaned: hours, A, OFF, or empty. Days past the end of the month are
 * ignored and counted. Rows with neither an ID nor a name are dropped.
 */
export function parseGridRecords(records: Record<string, string>[], dayCount: number): ParsedGrid {
  const out: GridRow[] = [];
  let ignoredDays = 0;
  const seen = new Set<string>();
  for (const rec of records) {
    const byDetail: Partial<Record<(typeof GRID_DETAIL_HEADERS)[number], string>> = {};
    const days: string[] = Array(dayCount).fill("");
    for (const [h, v] of Object.entries(rec)) {
      const k = norm(h);
      const dayMatch = /^(?:day )?0?(\d{1,2})$/.exec(k);
      if (dayMatch) {
        const d = Number(dayMatch[1]);
        if (d >= 1 && d <= 31) {
          if (d > dayCount) { if ((v ?? "").trim()) ignoredDays++; continue; }
          days[d - 1] = cleanDayValue(v);
          seen.add("days");
        }
        continue;
      }
      for (const [canon, aliases] of Object.entries(ALIASES)) if (aliases.includes(k)) { byDetail[canon as keyof typeof byDetail] = (v ?? "").trim(); seen.add(canon); }
    }
    const employeeIdNo = byDetail["ID No"] ?? "";
    const employeeName = byDetail["Employee Name"] ?? "";
    if (!employeeIdNo && !employeeName) continue;
    out.push({ employeeIdNo, employeeName, trade: byDetail.Trade ?? "", rate: byDetail["Cost Rate"] ?? "", supplierName: byDetail.Supplier ?? "", clientName: byDetail.Client ?? "", days });
  }
  const missingColumns: string[] = [];
  if (records.length > 0) {
    if (!seen.has("ID No") && !seen.has("Employee Name")) missingColumns.push("ID No or Employee Name");
    if (!seen.has("days")) missingColumns.push("day columns (1, 2, 3 …)");
  }
  return { rows: out, ignoredDays, missingColumns };
}
