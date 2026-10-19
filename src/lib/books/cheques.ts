import { r2, utcDay, type Posting } from "./postings";

export type ChequeFacts = {
  id: string; direction: "RECEIVED" | "ISSUED"; number: string; amount: number;
  partyType: "CLIENT" | "SUPPLIER" | "OTHER"; partyId: string | null; partyName: string;
  bankId: string | null; counterAccountId: string | null; narration: string | null;
  status: string; clearedOn: Date | null;
};

/**
 * A cheque only reaches the books when it clears: a received one is money in (against the client's balance or another
 * account), an issued one is money out. Pending, bounced and cancelled cheques post nothing.
 */
export function chequePostings(c: ChequeFacts): Posting[] {
  if (c.status !== "CLEARED" || !c.clearedOn || c.amount <= 0) return [];
  const amount = r2(c.amount);
  const bank = { tag: "BANK", ...(c.bankId ? { bankId: c.bankId } : {}) };
  const received = c.direction === "RECEIVED";
  const other = c.counterAccountId ? { tag: "OTHER", accountId: c.counterAccountId } : null;
  let side;
  if (c.partyType === "CLIENT") side = { tag: "RECEIVABLE", partyType: "CLIENT" as const, ...(c.partyId ? { partyId: c.partyId } : {}) };
  else if (c.partyType === "SUPPLIER") side = { tag: "PAYABLE", partyType: "SUPPLIER" as const, ...(c.partyId ? { partyId: c.partyId } : {}) };
  else if (other) side = other;
  else return [];
  const narration = `Cheque ${c.number} ${received ? "from" : "to"} ${c.partyName}${c.narration ? ` — ${c.narration}` : ""}`;
  return [{
    sourceKey: `cheque:${c.id}`, date: utcDay(c.clearedOn), type: received ? "RECEIPT" : "PAYMENT", narration,
    lines: received ? [{ ...bank, debit: amount }, { ...side, credit: amount }] : [{ ...side, debit: amount }, { ...bank, credit: amount }],
  }];
}

export type ChequeSummary = { pendingReceived: number; pendingIssued: number; dueSoon: number; overdue: number };

/** What is sitting in the register: post-dated cheques in hand and out, and those due within a week or already past their date. */
export function summariseCheques(rows: { direction: string; status: string; amount: number; chequeDate: Date }[], today: Date): ChequeSummary {
  const week = new Date(today.getTime() + 7 * 86_400_000);
  const s: ChequeSummary = { pendingReceived: 0, pendingIssued: 0, dueSoon: 0, overdue: 0 };
  for (const r of rows) {
    if (r.status !== "PENDING") continue;
    if (r.direction === "RECEIVED") s.pendingReceived = r2(s.pendingReceived + r.amount); else s.pendingIssued = r2(s.pendingIssued + r.amount);
    if (r.chequeDate.getTime() < today.getTime()) s.overdue += 1;
    else if (r.chequeDate.getTime() <= week.getTime()) s.dueSoon += 1;
  }
  return s;
}
