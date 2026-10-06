// Pure (no server imports): what a company can change in a timesheet layout, and what each layout starts with.
import type { TimesheetTemplateKey } from "@/lib/timesheetTemplates";

/** The columns of the three table layouts. The standard layout is a day-by-day grid and has no column choices. */
export type ColumnDef = { key: string; label: string; required?: boolean };

export const TEMPLATE_COLUMNS: Record<Exclude<TimesheetTemplateKey, "standard">, ColumnDef[]> = {
  summary: [
    { key: "sn", label: "SN" }, { key: "id", label: "ID" }, { key: "name", label: "Name", required: true }, { key: "trade", label: "Trade" },
    { key: "days", label: "Days" }, { key: "absent", label: "Abs." }, { key: "hours", label: "Hours", required: true }, { key: "rate", label: "Rate" }, { key: "amount", label: "Amount (AED)" },
  ],
  trade: [
    { key: "sn", label: "SN" }, { key: "trade", label: "Trade", required: true }, { key: "workers", label: "Workers" },
    { key: "hours", label: "Hours", required: true }, { key: "rate", label: "Rate (AED/hr)" }, { key: "amount", label: "Amount (AED)" },
  ],
  signoff: [
    { key: "sn", label: "SN" }, { key: "id", label: "ID" }, { key: "name", label: "Name", required: true }, { key: "trade", label: "Trade" },
    { key: "project", label: "Project" }, { key: "days", label: "Days" }, { key: "hours", label: "Hours", required: true }, { key: "engineer", label: "Site engineer initials" },
  ],
};

export type TemplateConfig = {
  /** Heading printed above the table. Empty = the layout's own heading. */
  title: string;
  /** Column wording by column key; missing = the layout's own wording. */
  headings: Record<string, string>;
  /** Column keys not printed. */
  hiddenColumns: string[];
  header: { logo: boolean; address: boolean; phone: boolean; email: boolean; poBox: boolean; trn: boolean; subContractor: boolean; issuedTo: boolean; period: boolean };
  blocks: { totals: boolean; deductions: boolean; vat: boolean; notes: boolean };
  /** Printed under the figures, one paragraph per line. */
  notes: string;
  /** Signature boxes, left to right. */
  signatures: string[];
  /** Empty = the sheet's own VAT %. */
  vatPercent: number | null;
  footer: string;
};

export const MAX_SIGNATURES = 4;
const trimmed = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

export function defaultConfig(base: TimesheetTemplateKey): TemplateConfig {
  return {
    title: "",
    headings: {},
    hiddenColumns: [],
    header: { logo: true, address: true, phone: true, email: true, poBox: true, trn: true, subContractor: true, issuedTo: true, period: true },
    blocks: { totals: true, deductions: true, vat: true, notes: true },
    notes: "",
    signatures: base === "standard" ? ["PREPARED BY", "VERIFIED BY", "APPROVED BY"] : ["Prepared by", "Verified by", "Client approval (name, signature, stamp)"],
    vatPercent: null,
    footer: "",
  };
}

/** Whatever was stored (or typed) becomes a complete, safe config: unknown keys dropped, limits applied. */
export function normalizeConfig(base: TimesheetTemplateKey, raw: unknown): TemplateConfig {
  const d = defaultConfig(base);
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const cols = base === "standard" ? [] : TEMPLATE_COLUMNS[base];
  const validKeys = new Set(cols.map((c) => c.key));
  const required = new Set(cols.filter((c) => c.required).map((c) => c.key));
  const headings: Record<string, string> = {};
  for (const [k, v] of Object.entries((r.headings && typeof r.headings === "object" ? r.headings : {}) as Record<string, unknown>)) {
    const t = trimmed(v, 60);
    if (validKeys.has(k) && t) headings[k] = t;
  }
  const hidden = Array.isArray(r.hiddenColumns) ? r.hiddenColumns.filter((k): k is string => typeof k === "string" && validKeys.has(k) && !required.has(k)) : [];
  const h = (r.header && typeof r.header === "object" ? r.header : {}) as Record<string, unknown>;
  const b = (r.blocks && typeof r.blocks === "object" ? r.blocks : {}) as Record<string, unknown>;
  const sigs = Array.isArray(r.signatures) ? r.signatures.map((x) => trimmed(x, 60)).filter(Boolean).slice(0, MAX_SIGNATURES) : d.signatures;
  const vat = typeof r.vatPercent === "number" && Number.isFinite(r.vatPercent) && r.vatPercent >= 0 && r.vatPercent <= 100 ? r.vatPercent : null;
  return {
    title: trimmed(r.title, 120),
    headings,
    hiddenColumns: [...new Set(hidden)],
    header: Object.fromEntries(Object.entries(d.header).map(([k, dv]) => [k, bool(h[k], dv)])) as TemplateConfig["header"],
    blocks: Object.fromEntries(Object.entries(d.blocks).map(([k, dv]) => [k, bool(b[k], dv)])) as TemplateConfig["blocks"],
    notes: trimmed(r.notes, 3000),
    signatures: sigs,
    vatPercent: vat,
    footer: trimmed(r.footer, 160),
  };
}

/** The columns a layout will print, with the company's wording, in order. */
export function visibleColumns(base: Exclude<TimesheetTemplateKey, "standard">, cfg: TemplateConfig | null): ColumnDef[] {
  const hidden = new Set(cfg?.hiddenColumns ?? []);
  return TEMPLATE_COLUMNS[base].filter((c) => !hidden.has(c.key)).map((c) => ({ ...c, label: cfg?.headings[c.key] || c.label }));
}
