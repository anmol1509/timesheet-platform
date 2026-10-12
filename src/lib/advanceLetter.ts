import { amountInWords, methodLabel, type ScheduleRow } from "@/lib/advances";

/**
 * The merge-field values for an advance letter (see the "Advance:" fields in letterFields), worked out from plain
 * facts so the wording can be tested without a database. Dates arrive as YYYY-MM-DD and print as DD-MM-YYYY like
 * every other letter.
 */
export type AdvanceFacts = {
  ref: string;
  kind: string; // "Advance" | "Loan"
  amount: number;
  reason: string | null;
  requestedOn: string;
  requestedBy: string;
  approval: { status: "PENDING" | "APPROVED" | "REJECTED"; by: string | null; on: string | null };
  given: { date: string; method: string | null; reference: string | null } | null;
  plan: ScheduleRow[];
  balance: number;
};

const money = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (iso: string | null) => (iso ? iso.split("-").reverse().join("-") : "");
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export function advanceLetterValues(f: AdvanceFacts): Record<string, string> {
  const approved = f.approval.status === "APPROVED";
  return {
    ADVANCEAMOUNT: money(f.amount),
    ADVANCEWORDS: amountInWords(f.amount),
    ADVANCEREF: f.ref,
    ADVANCETYPE: f.kind === "Loan" ? "loan" : "advance",
    ADVANCEREASON: f.reason ?? "",
    ADVANCEREQUESTEDON: date(f.requestedOn),
    ADVANCEREQUESTEDBY: f.requestedBy,
    ADVANCEAPPROVAL: approved ? `Approved${f.approval.by ? ` by ${f.approval.by}` : ""}${f.approval.on ? ` on ${date(f.approval.on)}` : ""}` : f.approval.status === "REJECTED" ? "Not approved" : "Awaiting approval",
    ADVANCEAPPROVEDBY: approved ? f.approval.by ?? "" : "",
    ADVANCEAPPROVEDON: approved ? date(f.approval.on) : "",
    ADVANCEGIVEN: f.given ? date(f.given.date) : "not yet handed over",
    ADVANCEPAYMENT: f.given ? `${methodLabel(f.given.method).toLowerCase()}${f.given.reference ? `, ref ${f.given.reference}` : ""}` : "",
    ADVANCEPLAN: f.plan.map((r) => `${monthName(r.month)}: AED ${money(r.amount)}`).join("; "),
    ADVANCEBALANCE: money(f.balance),
  };
}
