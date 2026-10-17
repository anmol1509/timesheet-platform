import Link from "next/link";
import { Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { branchWhere } from "@/lib/branch";
import { r2 } from "@/lib/books/postings";
import { aed, getBooksContext } from "../books-data";
import { SetupCard } from "../setup-card";

export const metadata = { title: "Client & supplier ledgers" };

export default async function PartiesPage({ searchParams }: { searchParams: Promise<{ type?: string; all?: string; q?: string }> }) {
  const ctx = await getBooksContext();
  const sp = await searchParams;
  const type = sp.type === "SUPPLIER" ? "SUPPLIER" : "CLIENT";
  const header = <PageHeader title="Client & supplier ledgers" icon={Users} breadcrumbs={[{ label: "Finance", href: "/finance/books" }, { label: "Books", href: "/finance/books" }, { label: "Parties" }]} description="What each client owes you and what you owe each supplier, line by line from the books." />;
  if (!ctx.branch || !ctx.initialized) return <div className="space-y-5">{header}<SetupCard isAdmin={ctx.isAdmin} /></div>;
  const branchId = ctx.branch.id;
  const tag = type === "CLIENT" ? "RECEIVABLE" : "PAYABLE";
  const sign = type === "CLIENT" ? 1 : -1;
  const control = await prisma.account.findFirst({ where: { branchId, tag }, select: { id: true, name: true } });
  const [parties, sums, controlSum] = await Promise.all([
    type === "CLIENT" ? prisma.client.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }) : prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    control ? prisma.journalLine.groupBy({ by: ["partyId"], where: { accountId: control.id, partyType: type, entry: { branchId, status: "POSTED" } }, _sum: { debit: true, credit: true } }) : [],
    control ? prisma.journalLine.aggregate({ where: { accountId: control.id, entry: { branchId, status: "POSTED" } }, _sum: { debit: true, credit: true } }) : null,
  ]);
  const bal = new Map(sums.map((s) => [s.partyId, r2((Number(s._sum.debit ?? 0) - Number(s._sum.credit ?? 0)) * sign)]));
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = parties.map((p) => ({ ...p, balance: bal.get(p.id) ?? 0 })).filter((p) => (sp.all === "1" || p.balance !== 0) && (!q || p.name.toLowerCase().includes(q))).sort((a, b) => b.balance - a.balance);
  const assigned = [...bal.values()].reduce((n, v) => n + v, 0);
  const total = controlSum ? r2((Number(controlSum._sum.debit ?? 0) - Number(controlSum._sum.credit ?? 0)) * sign) : 0;
  const unassigned = r2(total - assigned);
  const qs = (o: Record<string, string>) => `?${new URLSearchParams({ type, ...(sp.all === "1" ? { all: "1" } : {}), ...o })}`;
  return (
    <div className="space-y-5">
      {header}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5" role="group" aria-label="Ledger type">
          {(["CLIENT", "SUPPLIER"] as const).map((t) => <Link key={t} href={`/finance/books/parties?type=${t}`} className={`rounded-full border px-3 py-1 text-xs font-medium ${type === t ? "border-accent bg-accent-soft text-accent" : "border-border text-secondary hover:bg-surface-hover"}`}>{t === "CLIENT" ? "Clients" : "Suppliers"}</Link>)}
        </div>
        <Link href={`/finance/books/parties${sp.all === "1" ? `?type=${type}` : qs({ all: "1" })}`} className="text-xs text-muted hover:underline">{sp.all === "1" ? "Only those with a balance" : "Include settled"}</Link>
        <form className="ml-auto"><input type="hidden" name="type" value={type} /><input name="q" defaultValue={sp.q ?? ""} placeholder="Search" aria-label="Search" className="input h-8 w-52 text-sm" /></form>
      </div>
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 text-sm">
        <span className="text-muted">{control?.name ?? tag} in the books </span><span className="tabular font-semibold text-primary">{aed(total)}</span>
        {unassigned !== 0 && <span className="ml-3 text-warning">{aed(Math.abs(unassigned))} {unassigned > 0 ? "not assigned to anyone yet (opening balance)" : "assigned beyond the account total"}</span>}
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted">Nothing owed.</p> : (
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface text-sm">
          {rows.map((p) => <li key={p.id}><Link href={`/finance/books/parties/${type}/${p.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-hover"><span className="truncate text-primary">{p.name}</span><span className={`tabular ${p.balance < 0 ? "text-warning" : ""}`}>{aed(p.balance)}</span></Link></li>)}
        </ul>
      )}
    </div>
  );
}
