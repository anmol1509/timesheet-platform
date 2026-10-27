import { prisma } from "@/lib/db";
import { PAYING_STATUSES, monthlyEquivalent } from "@/lib/owner";
import { collectExtra, type CustomerStats } from "@/lib/ownerStats";
import { DEFAULT_RATES, buildCostReport, claudeCostUsd, emailSignal, parseRates, watchSignals, type Rates, type Signal } from "@/lib/ownerCosts";

export const RATES_KEY = "rates";

export async function loadRates(): Promise<Rates> {
  const row = await prisma.ownerSetting.findUnique({ where: { key: RATES_KEY } }).catch(() => null);
  return row ? parseRates(row.value) : DEFAULT_RATES;
}

export type WatchRow = { code: string; name: string; signals: Record<string, Signal | null>; readAt: string | null };

/** Everything the Costs & capacity page and the alert strip need, from what was last read from each customer plus this deployment's own database. */
export async function loadCostData() {
  const [rates, customers] = await Promise.all([loadRates(), prisma.customer.findMany({ where: { status: { not: "CHURNED" } }, orderBy: { name: "asc" } })]);
  const rows = customers.map((c) => ({ c, stats: (c.lastStats ?? null) as CustomerStats | null }));
  const report = buildCostReport(
    rows.map(({ c, stats }) => ({ code: c.code, name: c.name, revenueAed: PAYING_STATUSES.has(c.status) ? monthlyEquivalent(Number(c.planPriceAed), c.billingCycle) : 0, stats })),
    rates,
  );
  const watch: WatchRow[] = rows.map(({ c, stats }, i) => ({
    code: c.code,
    name: c.name,
    readAt: stats?.at ?? null,
    signals: stats ? watchSignals({ dbBytes: stats.db?.bytes, connections: stats.connections, aiLeftPct: stats.ai.total > 0 ? (stats.ai.remaining / stats.ai.total) * 100 : undefined, claudeAed: report.perCustomer[i].claudeAed, revenueAed: report.perCustomer[i].revenueAed }, rates) : {},
  }));
  const own = await collectExtra({}, true).catch(() => ({}) as Awaited<ReturnType<typeof collectExtra>>);
  const mainSignals = watchSignals({ dbBytes: own.db?.bytes, connections: own.connections }, rates);
  const emailsSent = rows.reduce((s, r) => s + (r.stats?.emailsSent ?? 0), 0) + (own.emailsSent ?? 0);
  const email = emailSignal(emailsSent, rates);
  const claudeUsd = rows.reduce((s, r) => s + claudeCostUsd(r.stats?.aiTokens, rates), 0);
  const tokens = rows.reduce((s, r) => s + (r.stats?.aiTokens ?? []).reduce((t, m) => t + m.input + m.output, 0), 0);
  const creditsGivenAed = rows.reduce((s, r) => s + (r.stats?.ai.used ?? 0) * Number(r.c.aiRateAed), 0);
  const flagged = [...watch.flatMap((w) => Object.values(w.signals)), ...Object.values(mainSignals), email].filter((s): s is Signal => !!s && s.level !== "ok");
  return { rates, report, watch, mainSignals, email, emailsSent, claudeUsd, tokens, creditsGivenAed, flagged, mainDb: own.db?.bytes };
}
