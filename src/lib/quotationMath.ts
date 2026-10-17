/**
 * Pricing maths for quotations, shared by the form, the page and the PDF so all three agree.
 *
 * A line is priced per MONTH (the default), DAY, HOUR or a CUSTOM unit. Every line is also
 * expressed as "per worker per month" so lines in different units can be added and compared.
 * Taxes, discounts and charges are optional and named by the user. Cost and profit are
 * private and optional.
 */

export type PriceUnit = "MONTH" | "DAY" | "HOUR" | "CUSTOM";

export type QuoteSettings = {
  daysPerMonth: number;
  hoursPerDay: number;
  /** Units the user defined, e.g. per shift = 30 a month. */
  units: { key: string; label: string; perMonth: number }[];
  /** Monthly cost per worker of the parts that are the same for everyone. */
  costDefaults: { permits: number; accommodation: number; transport: number; ppe: number; food: number };
  /** Optional goal for profit per worker per month. */
  targetProfit: number | null;
};

export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = {
  daysPerMonth: 26,
  hoursPerDay: 8,
  units: [],
  costDefaults: { permits: 0, accommodation: 0, transport: 0, ppe: 0, food: 0 },
  targetProfit: null,
};

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);

/** Reads settings saved as JSON, filling anything missing with the defaults. */
export function parseQuoteSettings(raw: unknown): QuoteSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const cd = o.costDefaults && typeof o.costDefaults === "object" ? (o.costDefaults as Record<string, unknown>) : {};
  const d = DEFAULT_QUOTE_SETTINGS;
  const units = Array.isArray(o.units)
    ? o.units
        .map((u) => (u && typeof u === "object" ? (u as Record<string, unknown>) : null))
        .filter((u): u is Record<string, unknown> => !!u && typeof u.label === "string" && typeof u.perMonth === "number" && u.perMonth > 0)
        .map((u) => ({ key: String(u.key || u.label), label: String(u.label), perMonth: u.perMonth as number }))
    : [];
  return {
    daysPerMonth: num(o.daysPerMonth, d.daysPerMonth) || d.daysPerMonth,
    hoursPerDay: num(o.hoursPerDay, d.hoursPerDay) || d.hoursPerDay,
    units,
    costDefaults: {
      permits: num(cd.permits, 0),
      accommodation: num(cd.accommodation, 0),
      transport: num(cd.transport, 0),
      ppe: num(cd.ppe, 0),
      food: num(cd.food, 0),
    },
    targetProfit: typeof o.targetProfit === "number" && o.targetProfit > 0 ? o.targetProfit : null,
  };
}

export type PricedLine = {
  quantity: number;
  rate: number;
  unit?: string | null;
  unitLabel?: string | null;
  unitsPerMonth?: number | null;
  hoursPerDay?: number | null;
  durationMonths?: number | null;
  costPerMonth?: number | null;
};

/** How many of the line's unit fit in one month. */
export function perMonthFactor(line: Pick<PricedLine, "unit" | "unitsPerMonth" | "hoursPerDay">, s: QuoteSettings): number {
  switch (line.unit) {
    case "DAY":
      return s.daysPerMonth;
    case "HOUR":
      return s.daysPerMonth * (line.hoursPerDay && line.hoursPerDay > 0 ? line.hoursPerDay : s.hoursPerDay);
    case "CUSTOM":
      return line.unitsPerMonth && line.unitsPerMonth > 0 ? line.unitsPerMonth : 1;
    default:
      return 1;
  }
}

export const unitWord = (line: Pick<PricedLine, "unit" | "unitLabel">) =>
  line.unit === "DAY" ? "day" : line.unit === "HOUR" ? "hour" : line.unit === "CUSTOM" ? (line.unitLabel || "unit") : "month";

/** One worker, one month, at the quoted price. */
export const monthlyEach = (line: PricedLine, s: QuoteSettings) => line.rate * perMonthFactor(line, s);
/** The whole line for one month. */
export const monthlyTotal = (line: PricedLine, s: QuoteSettings) => line.quantity * monthlyEach(line, s);

/** "8.50 × 10 h × 26 days" — how a per-day or per-hour price becomes a month. Null for a per-month price. */
export function conversionNote(line: PricedLine, s: QuoteSettings): string | null {
  if (line.unit === "DAY") return `${line.rate} × ${s.daysPerMonth} days`;
  if (line.unit === "HOUR") return `${line.rate} × ${line.hoursPerDay && line.hoursPerDay > 0 ? line.hoursPerDay : s.hoursPerDay} h × ${s.daysPerMonth} days`;
  if (line.unit === "CUSTOM") return `${line.rate} × ${perMonthFactor(line, s)} ${unitWord(line)}${perMonthFactor(line, s) === 1 ? "" : "s"}`;
  return null;
}

export type Adjustment = { kind: "TAX" | "DISCOUNT" | "CHARGE"; name: string; mode: "PERCENT" | "FIXED"; value: number };

/** Reads adjustments saved as JSON, dropping anything malformed. */
export function parseAdjustments(raw: unknown): Adjustment[] {
  if (!Array.isArray(raw)) return [];
  const out: Adjustment[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const kind = o.kind === "TAX" || o.kind === "DISCOUNT" || o.kind === "CHARGE" ? o.kind : null;
    const mode = o.mode === "FIXED" ? "FIXED" : "PERCENT";
    const value = typeof o.value === "number" && Number.isFinite(o.value) && o.value >= 0 ? o.value : null;
    if (!kind || value === null || typeof o.name !== "string" || !o.name.trim()) continue;
    out.push({ kind, name: o.name.trim(), mode, value });
  }
  return out;
}

export type QuoteTotals = {
  subtotal: number;
  rows: { name: string; kind: Adjustment["kind"]; amount: number; label: string; /** Position in the adjustments list, so a row can be removed. */ index: number }[];
  total: number;
  /** Whole-contract subtotal, only when every line has a duration. */
  contractSubtotal: number | null;
};

/**
 * Per-month totals. Discounts come off the subtotal first, then charges are added, then taxes
 * apply to that amount — so a 5% VAT is on the discounted price plus any charges.
 */
export function quoteTotals(lines: PricedLine[], adjustments: Adjustment[], s: QuoteSettings): QuoteTotals {
  const subtotal = lines.reduce((n, l) => n + monthlyTotal(l, s), 0);
  const amountOf = (a: Adjustment, base: number) => (a.mode === "PERCENT" ? (base * a.value) / 100 : a.value);
  const rows: QuoteTotals["rows"] = [];
  let running = subtotal;
  for (const kind of ["DISCOUNT", "CHARGE", "TAX"] as const) {
    const base = running;
    for (const a of adjustments.filter((x) => x.kind === kind)) {
      const amt = amountOf(a, kind === "TAX" ? running : base);
      const signed = kind === "DISCOUNT" ? -amt : amt;
      rows.push({ name: a.name, kind, amount: signed, label: a.mode === "PERCENT" ? `${a.name} ${a.value}%` : a.name, index: adjustments.indexOf(a) });
      if (kind !== "TAX") running += signed;
    }
    if (kind === "TAX") running = running + rows.filter((r) => r.kind === "TAX").reduce((n, r) => n + r.amount, 0);
  }
  const allDurations = lines.length > 0 && lines.every((l) => l.durationMonths && l.durationMonths > 0);
  return {
    subtotal,
    rows,
    total: running,
    contractSubtotal: allDurations ? lines.reduce((n, l) => n + monthlyTotal(l, s) * (l.durationMonths as number), 0) : null,
  };
}

export type LineProfit = { each: number; pct: number | null; belowCost: boolean };

/** Profit on one worker for one month, or null when no cost was entered for the line. */
export function lineProfit(line: PricedLine, s: QuoteSettings): LineProfit | null {
  if (line.costPerMonth == null || !Number.isFinite(line.costPerMonth)) return null;
  const sell = monthlyEach(line, s);
  const each = sell - line.costPerMonth;
  return { each, pct: sell > 0 ? (each / sell) * 100 : null, belowCost: each < 0 };
}

/** Profit across the lines that have a cost: per month, and as a share of what those lines bill. */
export function quoteProfit(lines: PricedLine[], s: QuoteSettings): { perMonth: number; pct: number | null; counted: number; skipped: number } {
  let profit = 0;
  let billed = 0;
  let counted = 0;
  for (const l of lines) {
    const p = lineProfit(l, s);
    if (!p) continue;
    counted++;
    profit += p.each * l.quantity;
    billed += monthlyTotal(l, s);
  }
  return { perMonth: profit, pct: billed > 0 ? (profit / billed) * 100 : null, counted, skipped: lines.length - counted };
}

export const RESPONSIBILITY_OPTIONS = ["By us", "Provided by client", "Shared", "Not applicable"] as const;
/** True when the terms say we provide it, so its cost counts against the worker. */
export const isByUs = (v: string | null | undefined) => !!v && (/^by us$/i.test(v.trim()) || /\bby (us|supplier|company)\b/i.test(v));

export type CostPart = { label: string; amount: number; note?: string };

/**
 * A starting cost for one worker per month: the trade's average pay plus the shared costs the
 * terms say we carry. The user can change any part, remove it or add their own.
 */
export function defaultCostParts(opts: { salary: number | null; accommodation: string | null; transport: string | null; ppe: string | null }, s: QuoteSettings): CostPart[] {
  const parts: CostPart[] = [];
  if (opts.salary != null) parts.push({ label: "Salary and allowances", amount: Math.round(opts.salary), note: "average for this trade" });
  if (s.costDefaults.permits > 0) parts.push({ label: "Visa, labour card, medical", amount: s.costDefaults.permits });
  if (isByUs(opts.accommodation) && s.costDefaults.accommodation > 0) parts.push({ label: "Accommodation", amount: s.costDefaults.accommodation, note: "terms: by us" });
  if (isByUs(opts.transport) && s.costDefaults.transport > 0) parts.push({ label: "Transport", amount: s.costDefaults.transport, note: "terms: by us" });
  if (isByUs(opts.ppe) && s.costDefaults.ppe > 0) parts.push({ label: "PPE", amount: s.costDefaults.ppe, note: "terms: by us" });
  return parts;
}

export const costOf = (parts: { amount: number }[]) => parts.reduce((n, p) => n + (Number.isFinite(p.amount) ? p.amount : 0), 0);
