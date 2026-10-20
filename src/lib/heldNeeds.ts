/** An open line on a demand: how many heads are still to fill. */
export type OpenLine = { requestId: string; requestNo: number; trade: string; remaining: number };

export type Need = { requestId: string; requestNo: number; trade: string; remaining: number };

const same = (a: string | null | undefined, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The open demand lines a supplier's held-back workers could fill: lines still short of heads whose trade is one
 * the held workers hold. Lines come back in the order given, at most `limit`.
 */
export function needsFor(heldTrades: string[], lines: OpenLine[], limit = 3): Need[] {
  return lines.filter((l) => l.remaining > 0 && heldTrades.some((t) => same(t, l.trade))).slice(0, limit);
}

/** Heads still to fill on a line: what was agreed (or asked, while undecided) less who is already mobilised. */
export function remainingOn(line: { quantity: number; approvedQuantity: number | null }, allocated: number): number {
  const agreed = line.approvedQuantity ?? line.quantity;
  return Math.max(0, agreed - allocated);
}
