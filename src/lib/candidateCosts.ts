/** What it costs to bring a candidate on board, and how it adds up. Pure, so the screens, the agency numbers and the sheets agree. */
export const COST_KINDS = [
  { value: "AGENCY_FEE", label: "Agency fee" },
  { value: "VISA", label: "Visa & permit fees" },
  { value: "MEDICAL", label: "Medical & Emirates ID" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "TICKET", label: "Air ticket" },
  { value: "OTHER", label: "Other" },
] as const;
export const COST_KIND_LABEL: Record<string, string> = Object.fromEntries(COST_KINDS.map((k) => [k.value, k.label]));
export const isCostKind = (v: string) => COST_KINDS.some((k) => k.value === v);

export type CostLike = { kind: string; amount: number; paid: boolean };
export type CostTotals = { total: number; paid: number; outstanding: number; byKind: Record<string, number> };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function costTotals(costs: CostLike[]): CostTotals {
  const byKind: Record<string, number> = {};
  let total = 0;
  let paid = 0;
  for (const c of costs) {
    total += c.amount;
    if (c.paid) paid += c.amount;
    byKind[c.kind] = round2((byKind[c.kind] ?? 0) + c.amount);
  }
  return { total: round2(total), paid: round2(paid), outstanding: round2(total - paid), byKind };
}

/** Spend per hire who actually joined; null until someone has. Money spent on dropped candidates still counts in the total. */
export function costPerJoinedHire(totalSpent: number, joined: number): number | null {
  return joined > 0 ? round2(totalSpent / joined) : null;
}

/** An amount typed on a form: a positive number with at most two decimals, or null. */
export function parseAmount(raw: string): number | null {
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) return null;
  return round2(n);
}
