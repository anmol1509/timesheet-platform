/**
 * The "Based on" line under an answer: which parts of the app the lookups behind it read.
 * Kept apart from the tools so the wording can be tested and a lookup that found nothing never counts as a source.
 */

const RECORD_KIND: Record<string, string> = { employee: "Employees", project: "Projects", client: "Clients", supplier: "Suppliers", demand: "Demand requests" };

const STAT: Record<string, string> = {
  workforce: "Workforce", document_expiry: "Document expiry", business_partners: "Clients, suppliers & projects", demands: "Demand requests",
  deployment: "Deployment", attendance: "Attendance", timesheets: "Timesheets", invoices: "Invoices", camps: "Camps", renewals: "Renewals", onboarding: "Onboarding",
};

const ROWS: Record<string, string> = {
  absent_today: "Attendance (today)", expiring_documents: "Renewals", timesheet_status: "Timesheets", unpaid_invoices: "Invoices",
  approved_not_invoiced: "Timesheets & invoices", idle_workers: "Workforce", missing_photo: "Workforce",
};

const month = (v: unknown) => (typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null);

/** What a tool read, from its name and input. Null for tools that read nothing worth naming. */
export function sourceFor(tool: string, input: Record<string, unknown>): string | null {
  const pick = (map: Record<string, string>, key: unknown) => (typeof key === "string" ? map[key] ?? null : null);
  switch (tool) {
    case "search_records": return pick(RECORD_KIND, input.kind);
    case "get_stats": {
      const base = pick(STAT, input.metric);
      const m = month(input.month);
      return base && m && (input.metric === "timesheets" || input.metric === "invoices") ? `${base} ${m}` : base;
    }
    case "list_rows": {
      const base = pick(ROWS, input.kind);
      const m = month(input.month);
      return base && m && input.kind === "timesheet_status" ? `${base} ${m}` : base;
    }
    case "explain_payroll_line":
    case "explain_missing_from_payroll":
    case "explain_payroll_blockers": {
      const m = month(input.month);
      return m ? `Payroll ${m}` : "Payroll";
    }
    case "find_help_guide": return "Help guides";
    case "draft_letter": return "Employees & letter templates";
    default: return null;
  }
}

/** A tool answer that carries no data (no access, no match, a failed lookup) is not something the reply was based on. */
export function carriedNoData(content: string): boolean {
  return /^(The user doesn't have access|Unknown|Query too short|Question too short|Need a |Invalid|That lookup failed|No guide matches|No pay line|No worker matches|No draft payroll|No employee|No employee letter)/.test(content);
}

/** Unique, in the order first read, and short enough for one line. */
export function collectSources(list: (string | null | undefined)[], max = 5): string[] {
  return [...new Set(list.filter((s): s is string => !!s))].slice(0, max);
}
