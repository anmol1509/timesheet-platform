import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { r2 } from "@/lib/books/postings";
import { aed, fmtDate, getBooksContext } from "../../../books-data";
import { PartyOpening } from "./party-opening";
import { PartyEntry } from "./party-entry";
import { iso } from "../../../books-data";

export const metadata = { title: "Ledger" };

export default async function PartyLedgerPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const ctx = await getBooksContext();
  const { type: raw, id } = await params;
  const type = raw === "SUPPLIER" ? "SUPPLIER" : raw === "CLIENT" ? "CLIENT" : null;
  if (!type || !ctx.branch || !ctx.initialized) notFound();
  const branchId = ctx.branch.id;
  const party = type === "CLIENT" ? await prisma.client.findUnique({ where: { id }, select: { name: true, branchId: true } }) : await prisma.supplier.findUnique({ where: { id }, select: { name: true, branchId: true } });
  if (!party || party.branchId !== branchId) notFound();
  const tag = type === "CLIENT" ? "RECEIVABLE" : "PAYABLE";
  const sign = type === "CLIENT" ? 1 : -1;
  const control = await prisma.account.findFirst({ where: { branchId, tag }, select: { id: true } });
  const lines = control ? await prisma.journalLine.findMany({
    where: { accountId: control.id, partyType: type, partyId: id, entry: { branchId, status: "POSTED" } },
    orderBy: [{ entry: { date: "asc" } }, { entry: { number: "asc" } }],
    include: { entry: { select: { date: true, number: true, narration: true, type: true, sourceKey: true } } },
  }) : [];
  const rows: { id: string; date: Date; number: string; narration: string; charge: number; payment: number; balance: number; opening: boolean }[] = [];
  for (const l of lines) {
    const d = Number(l.debit), c = Number(l.credit);
    rows.push({ id: l.id, date: l.entry.date, number: l.entry.number, narration: l.description || l.entry.narration, charge: sign === 1 ? d : c, payment: sign === 1 ? c : d, balance: r2((rows.at(-1)?.balance ?? 0) + (d - c) * sign), opening: l.entry.type === "OPENING" });
  }
  const run = rows.at(-1)?.balance ?? 0;
  const opening = rows.filter((r) => r.opening).reduce((n, r) => n + r.charge - r.payment, 0);
  const moneyAccounts = ctx.canWrite ? (await prisma.account.findMany({ where: { branchId, type: "ASSET", isActive: true, OR: [{ tag: { in: ["BANK", "CASH"] } }, { name: { contains: "bank", mode: "insensitive" } }] }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } })).map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` })) : [];
  const word = type === "CLIENT" ? { charge: "Invoiced", pay: "Received / credited", owes: "owes you" } : { charge: "Billed", pay: "Paid / debited", owes: "you owe" };
  return (
    <div className="space-y-5">
      <PageHeader title={party.name} icon={Users} breadcrumbs={[{ label: "Finance", href: "/finance/books" }, { label: "Books", href: "/finance/books" }, { label: "Parties", href: `/finance/books/parties?type=${type}` }, { label: party.name }]} description={`${type === "CLIENT" ? "Client" : "Supplier"} · ${run === 0 ? "nothing outstanding" : `${aed(Math.abs(run))} ${run > 0 ? word.owes : "paid in advance"}`}`} />
      {ctx.canWrite && <PartyEntry type={type} partyId={id} moneyAccounts={moneyAccounts} minDate={iso(ctx.branch.booksOpeningDate!)} />}
      <PartyOpening type={type} partyId={id} amount={opening} openingDate={fmtDate(ctx.branch.booksOpeningDate!)} canWrite={ctx.canWrite} />
      {rows.length === 0 ? <p className="text-sm text-muted">No entries for this {type === "CLIENT" ? "client" : "supplier"} yet.</p> : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-sunken)] text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">No.</th><th className="px-4 py-2 font-medium">Detail</th><th className="px-4 py-2 text-right font-medium">{word.charge}</th><th className="px-4 py-2 text-right font-medium">{word.pay}</th><th className="px-4 py-2 text-right font-medium">Balance</th></tr></thead>
            <tbody className="divide-y divide-border">
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
      <Link href={`/finance/books/parties?type=${type}`} className="text-sm text-muted hover:underline">← All {type === "CLIENT" ? "clients" : "suppliers"}</Link>
    </div>
  );
}
