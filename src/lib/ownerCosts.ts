/** What the platform really costs the owner, and when something needs upgrading. Pure rules, so they can be tested. */
import type { CustomerStats } from "@/lib/ownerStats";

export type ModelPrice = { family: string; inputUsd: number; outputUsd: number };

/** The owner's own rates. Every number here can be edited on the Costs & capacity page; these are only where it starts. */
export type Rates = {
  usdToAed: number;
  /** Claude price per million tokens, by model family. Matched by name ("sonnet" inside "claude-sonnet-5-5"). */
  models: ModelPrice[];
  supabasePlanUsd: number;
  /** Compute credit the Pro plan includes each month, taken off the compute bill. */
  supabaseComputeCreditUsd: number;
  /** Compute per month for the main website's database, and per customer by code. */
  mainComputeUsd: number;
  customerComputeUsd: Record<string, number>;
  /** Disk each database has, in GB (Pro includes 8 GB per project). */
  diskGb: number;
  vercelSeats: number;
  vercelSeatUsd: number;
  emailPlanUsd: number;
  /** Emails a month the plan allows (the Resend free plan: 3,000). */
  emailMonthlyLimit: number;
};

export const DEFAULT_RATES: Rates = {
  usdToAed: 3.67,
  models: [
    // The more specific name goes first: a model is priced by the first family its name contains.
    { family: "haiku-5", inputUsd: 0.1, outputUsd: 0.5 },
    { family: "haiku", inputUsd: 1, outputUsd: 5 },
    { family: "sonnet", inputUsd: 2, outputUsd: 10 },
    { family: "opus-5-5", inputUsd: 4, outputUsd: 20 },
    { family: "opus", inputUsd: 5, outputUsd: 25 },
    { family: "fable", inputUsd: 10, outputUsd: 50 },
  ],
  supabasePlanUsd: 25,
  supabaseComputeCreditUsd: 10,
  mainComputeUsd: 0,
  customerComputeUsd: {},
  diskGb: 8,
  vercelSeats: 1,
  vercelSeatUsd: 20,
  emailPlanUsd: 0,
  emailMonthlyLimit: 3000,
};

/** Fills in anything missing or wrong from stored settings with the defaults. */
export function parseRates(raw: unknown): Rates {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Rates>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);
  const d = DEFAULT_RATES;
  const compute: Record<string, number> = {};
  if (r.customerComputeUsd && typeof r.customerComputeUsd === "object") for (const [k, v] of Object.entries(r.customerComputeUsd)) compute[k.toUpperCase()] = num(v, 10);
  const saved = Array.isArray(r.models) && r.models.length ? r.models.filter((m) => m && typeof m.family === "string").map((m) => ({ family: m.family.toLowerCase(), inputUsd: num(m.inputUsd, 0), outputUsd: num(m.outputUsd, 0) })) : [];
  // Settings saved before a family existed (haiku-5, opus-5-5) pick it up at its default; what the owner saved stays as it was.
  const models = saved.length ? [...saved, ...d.models.filter((m) => !saved.some((x) => x.family === m.family))] : d.models;
  models.sort((a, b) => b.family.length - a.family.length);
  return {
    usdToAed: num(r.usdToAed, d.usdToAed) || d.usdToAed, models: models.length ? models : d.models,
    supabasePlanUsd: num(r.supabasePlanUsd, d.supabasePlanUsd), supabaseComputeCreditUsd: num(r.supabaseComputeCreditUsd, d.supabaseComputeCreditUsd),
    mainComputeUsd: num(r.mainComputeUsd, d.mainComputeUsd), customerComputeUsd: compute, diskGb: num(r.diskGb, d.diskGb) || d.diskGb,
    vercelSeats: num(r.vercelSeats, d.vercelSeats), vercelSeatUsd: num(r.vercelSeatUsd, d.vercelSeatUsd), emailPlanUsd: num(r.emailPlanUsd, d.emailPlanUsd), emailMonthlyLimit: num(r.emailMonthlyLimit, d.emailMonthlyLimit) || d.emailMonthlyLimit,
  };
}

/** What a customer's Micro database costs when the owner has not said otherwise. */
export const DEFAULT_CUSTOMER_COMPUTE_USD = 10;
export const computeUsdFor = (rates: Rates, code: string) => rates.customerComputeUsd[code.toUpperCase()] ?? DEFAULT_CUSTOMER_COMPUTE_USD;

/** The Claude cost, in USD, of a month's tokens. A model with no matching family is priced like the dearest one, so cost is never understated. */
export function claudeCostUsd(tokens: { model: string; input: number; output: number }[] | undefined, rates: Rates): number {
  if (!tokens) return 0;
  const dearest = rates.models.reduce((a, b) => (b.outputUsd > a.outputUsd ? b : a), rates.models[0]);
  return tokens.reduce((sum, t) => {
    const p = rates.models.find((m) => t.model.toLowerCase().includes(m.family)) ?? dearest;
    return sum + (t.input / 1e6) * p.inputUsd + (t.output / 1e6) * p.outputUsd;
  }, 0);
}

export type CostCustomer = { code: string; name: string; revenueAed: number; stats: CustomerStats | null };

export type CostReport = {
  lines: { label: string; aed: number; live: boolean }[];
  totalAed: number;
  revenueAed: number;
  marginAed: number;
  perCustomer: { code: string; name: string; revenueAed: number; claudeAed: number; computeAed: number; shareAed: number; marginAed: number }[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The month's costs and what each customer leaves you. Shared costs (the Supabase plan, the website, Vercel, email) are split equally between customers. */
export function buildCostReport(customers: CostCustomer[], rates: Rates): CostReport {
  const fx = rates.usdToAed;
  const claude = customers.map((c) => claudeCostUsd(c.stats?.aiTokens, rates) * fx);
  const compute = customers.map((c) => computeUsdFor(rates, c.code) * fx);
  const supabasePlan = rates.supabasePlanUsd * fx;
  const credit = Math.min(rates.supabaseComputeCreditUsd, rates.mainComputeUsd + compute.reduce((a, b) => a + b, 0) / fx) * fx;
  const main = rates.mainComputeUsd * fx;
  const vercel = rates.vercelSeats * rates.vercelSeatUsd * fx;
  const email = rates.emailPlanUsd * fx;
  const shared = supabasePlan - credit + main + vercel + email;
  const n = Math.max(1, customers.length);
  const lines = [
    { label: "Claude API", aed: r2(claude.reduce((a, b) => a + b, 0)), live: true },
    { label: "Supabase plan, less the included compute credit", aed: r2(supabasePlan - credit), live: false },
    { label: "Supabase compute: main website", aed: r2(main), live: false },
    ...customers.map((c, i) => ({ label: `Supabase compute: ${c.code}`, aed: r2(compute[i]), live: false })),
    { label: "Vercel Pro", aed: r2(vercel), live: false },
    { label: "Email", aed: r2(email), live: false },
  ];
  const totalAed = r2(lines.reduce((s, l) => s + l.aed, 0));
  const revenueAed = r2(customers.reduce((s, c) => s + c.revenueAed, 0));
  return {
    lines, totalAed, revenueAed, marginAed: r2(revenueAed - totalAed),
    perCustomer: customers.map((c, i) => ({ code: c.code, name: c.name, revenueAed: c.revenueAed, claudeAed: r2(claude[i]), computeAed: r2(compute[i]), shareAed: r2(shared / n), marginAed: r2(c.revenueAed - claude[i] - compute[i] - shared / n) })),
  };
}

export type Signal = { level: "ok" | "warn" | "bad"; text: string };

const level = (pct: number, warn: number, bad: number): Signal["level"] => (pct >= bad ? "bad" : pct >= warn ? "warn" : "ok");
const mb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : `${(b / 1024 ** 2).toFixed(1)} MB`);

/** The signs that something needs upgrading or topping up, for one place (a customer or the main website). Missing figures give no sign rather than a false "fine". */
export function watchSignals(s: { dbBytes?: number; connections?: { now: number; max: number }; aiLeftPct?: number; claudeAed?: number; revenueAed?: number }, rates: Rates): Record<string, Signal | null> {
  const dbPct = s.dbBytes === undefined ? null : (s.dbBytes / (rates.diskGb * 1024 ** 3)) * 100;
  const connPct = s.connections ? (s.connections.now / Math.max(1, s.connections.max)) * 100 : null;
  const spendPct = s.claudeAed !== undefined && s.revenueAed && s.revenueAed > 0 ? (s.claudeAed / s.revenueAed) * 100 : null;
  return {
    database: dbPct === null ? null : { level: level(dbPct, 70, 90), text: `${mb(s.dbBytes!)} of ${rates.diskGb} GB` },
    connections: connPct === null ? null : { level: level(connPct, 70, 90), text: `${s.connections!.now} of ${s.connections!.max}` },
    aiCredits: s.aiLeftPct === undefined ? null : { level: s.aiLeftPct <= 5 ? "bad" : s.aiLeftPct <= 20 ? "warn" : "ok", text: `${Math.round(s.aiLeftPct)}% left` },
    claudeSpend: spendPct === null ? null : { level: level(spendPct, 60, 80), text: `${Math.round(spendPct)}% of what they pay` },
  };
}

export function emailSignal(sent: number, rates: Rates): Signal {
  const pct = (sent / rates.emailMonthlyLimit) * 100;
  return { level: level(pct, 80, 95), text: `${sent.toLocaleString("en-US")} of ${rates.emailMonthlyLimit.toLocaleString("en-US")} this month` };
}
