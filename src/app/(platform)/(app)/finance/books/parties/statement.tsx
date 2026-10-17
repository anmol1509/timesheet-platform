import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can, canWrite } from "@/lib/permissions";
import { r2 } from "@/lib/books/postings";
import { aed, fmtDate, iso } from "../books-data";
import { PartyOpening } from "./[type]/[id]/party-opening";
import { PartyEntry } from "./[type]/[id]/party-entry";

/** True when this person may see the accounting statement of a client or supplier. */
export async function canSeeStatement() {
  const { user } = await requireUserWithBranch();
  return can(subjectOf(user), "finance.books", "view");
}

/**
 * What a client owes you, or what you owe a supplier, line by line, with the entries that change it. Shown on the
 * client and supplier pages and on the accounting Transactions drill-down. Renders nothing for people without access.
 */
export async function PartyStatement({ type, id }: { type: "CLIENT" | "SUPPLIER"; id: string }) {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  if (!branchId || !can(subject, "finance.books", "view")) return null;
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { booksOpeningDate: true } });
  if (!branch?.booksOpeningDate) {
    return <p className="rounded-[var(--radius-card)] border border-dashed border-default p-6 text-sm text-muted">Accounting isn&apos;t set up yet. <Link href="/finance/books" className="text-brand hover:underline">Start it</Link> to see statements here.</p>;
  }
  const writable = canWrite(subject, "finance.books");
  const tag = type === "CLIENT" ? "RECEIVABLE" : "PAYABLE";
  const sign = type === "CLIENT" ? 1 : -1;
  const control = await prisma.account.findFirst({ where: { branchId, tag }, select: { id: true } });
  const lines = control ? await prisma.journalLine.findMany({
    where: { accountId: control.id, partyType: type, partyId: id, entry: { branchId, status: "POSTED" } },
    orderBy: [{ entry: { date: "asc" } }, { entry: { number: "asc" } }],
    include: { entry: { select: { date: true, number: true, narration: true, type: true } } },
  }) : [];
  const rows: { id: string; date: Date; number: string; narration: string; charge: number; payment: number; balance: number; opening: boolean }[] = [];
  for (const l of lines) {
    const d = Number(l.debit), c = Number(l.credit);
    rows.push({ id: l.id, date: l.entry.date, number: l.entry.number, narration: l.description || l.entry.narration, charge: sign === 1 ? d : c, payment: sign === 1 ? c : d, balance: r2((rows.at(-1)?.balance ?? 0) + (d - c) * sign), opening: l.entry.type === "OPENING" });
  }
  const balance = rows.at(-1)?.balance ?? 0;
  const opening = rows.filter((r) => r.opening).reduce((n, r) => n + r.charge - r.payment, 0);
  const moneyAccounts = writable ? (await prisma.account.findMany({ where: { branchId, type: "ASSET", isActive: true, OR: [{ tag: { in: ["BANK", "CASH"] } }, { name: { contains: "bank", mode: "insensitive" } }] }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } })).map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` })) : [];
  const word = type === "CLIENT" ? { charge: "Invoiced", pay: "Received / credited", owes: "owes you", label: "They owe you" } : { charge: "Billed", pay: "Paid / debited", owes: "you owe", label: "You owe them" };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm text-muted">{word.label}</p><p className="tabular text-3xl font-semibold text-primary">{aed(Math.abs(balance))}{balance < 0 ? <span className="ml-2 text-sm font-normal text-muted">paid in advance</span> : null}</p></div>
        {writable && <PartyEntry type={type} partyId={id} moneyAccounts={moneyAccounts} minDate={iso(branch.booksOpeningDate)} />}
      </div>
      <PartyOpening type={type} partyId={id} amount={opening} openingDate={fmtDate(branch.booksOpeningDate)} canWrite={writable} />
      {rows.length === 0 ? <p className="text-sm text-muted">No entries for this {type === "CLIENT" ? "client" : "supplier"} yet.</p> : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-default bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-sunken)] text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">No.</th><th className="px-4 py-2 font-medium">Detail</th><th className="px-4 py-2 text-right font-medium">{word.charge}</th><th className="px-4 py-2 text-right font-medium">{word.pay}</th><th className="px-4 py-2 text-right font-medium">Balance</th></tr></thead>
            <tbody className="divide-y divide-default">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2">{fmtDate(r.date)}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{r.number}</td>
                  <td className="px-4 py-2 text-secondary">{r.opening ? "Opening balance" : r.narration}</td>
                  <td className="tabular px-4 py-2 text-right">{r.charge ? aed(r.charge) : ""}</td>
                  <td className="tabular px-4 py-2 text-right">{r.payment ? aed(r.payment) : ""}</td>
                  <td className="tabular px-4 py-2 text-right font-medium">{aed(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
