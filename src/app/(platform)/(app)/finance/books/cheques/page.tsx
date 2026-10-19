import Link from "next/link";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { PageHeader } from "@/components/PageHeader";
import { summariseCheques } from "@/lib/books/cheques";
import { listBanks } from "@/lib/books/banks";
import { aed, fmtDate, getBooksContext } from "../books-data";
import { SetupCard } from "../setup-card";
import { AddCheque, ChequeActions } from "./cheque-forms";

export const metadata = { title: "Cheques" };
const FILTERS = [{ k: "PENDING", l: "Waiting" }, { k: "CLEARED", l: "Cleared" }, { k: "BOUNCED", l: "Bounced" }, { k: "ALL", l: "All" }] as const;
const TONE: Record<string, string> = { PENDING: "bg-warning-soft text-warning", CLEARED: "bg-success-soft text-success", BOUNCED: "bg-error-soft text-error", CANCELLED: "bg-[var(--surface-sunken)] text-muted" };

export default async function ChequesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await getBooksContext();
  const header = (right?: React.ReactNode) => <PageHeader title="Cheques" icon={FileText} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Accounting", href: "/finance/books" }, { label: "Cheques" }]} description="Cheques received and issued, including post-dated ones. They reach the books when they clear." actions={right} />;
  if (!ctx.branch || !ctx.initialized) return <div className="space-y-5">{header()}<SetupCard isAdmin={ctx.isAdmin} /></div>;
  const sp = await searchParams;
  const status = FILTERS.some((f) => f.k === sp.status) ? (sp.status as string) : "PENDING";
  const branchId = ctx.branch.id;
  const [all, clients, suppliers, banks, accounts] = await Promise.all([
    prisma.cheque.findMany({ where: { branchId }, orderBy: [{ chequeDate: "asc" }, { createdAt: "asc" }], take: 500 }),
    prisma.client.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    listBanks(branchId),
    prisma.account.findMany({ where: { branchId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sum = summariseCheques(all.map((c) => ({ direction: c.direction, status: c.status, amount: Number(c.amount), chequeDate: c.chequeDate })), todayUtc);
  const shown = status === "ALL" ? all : all.filter((c) => c.status === status);
  const bankName = new Map(banks.map((b) => [b.id, b.label]));
  return (
    <div className="space-y-5">
      {header(ctx.canWrite ? <AddCheque clients={clients.map((c) => ({ id: c.id, label: c.name }))} suppliers={suppliers.map((s) => ({ id: s.id, label: s.name }))} banks={banks} accounts={accounts.map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` }))} /> : undefined)}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Post-dated cheques in hand", aed(sum.pendingReceived), ""], ["Cheques issued, not yet cleared", aed(sum.pendingIssued), ""], ["Due in the next 7 days", String(sum.dueSoon), ""], ["Past their date, still waiting", String(sum.overdue), sum.overdue ? "text-error" : ""]].map(([l, v, c]) => (
          <div key={l} className="rounded-[var(--radius-card)] border border-default bg-surface p-4"><p className="text-xs text-muted">{l}</p><p className={`tabular mt-1 text-lg font-semibold ${c || "text-primary"}`}>{v}</p></div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
        {FILTERS.map((f) => <Link key={f.k} href={`/finance/books/cheques?status=${f.k}`} className={`rounded-full border px-3 py-1 text-xs font-medium ${status === f.k ? "border-brand bg-brand-soft text-brand" : "border-default text-secondary hover:bg-surface-hover"}`}>{f.l}</Link>)}
      </div>
      <section className="overflow-x-auto rounded-[var(--radius-card)] border border-default bg-surface">
        {shown.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">Nothing here.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-sunken)] text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Cheque date</th><th className="px-3 py-2 font-medium">No.</th><th className="px-3 py-2 font-medium">With</th><th className="px-3 py-2 font-medium">Bank</th><th className="px-3 py-2 text-right font-medium">Amount</th><th className="px-3 py-2 font-medium">Status</th><th className="px-4 py-2" /></tr></thead>
            <tbody className="divide-y divide-default">
              {shown.map((c) => {
                const late = c.status === "PENDING" && c.chequeDate.getTime() < todayUtc.getTime();
                return (
                  <tr key={c.id}>
                    <td className={`px-4 py-2 ${late ? "font-medium text-error" : ""}`}>{fmtDate(c.chequeDate)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{c.number}</td>
                    <td className="px-3 py-2"><span className="font-medium text-primary">{c.partyName}</span><span className="ml-2 text-xs text-muted">{c.direction === "RECEIVED" ? "received" : "issued"}</span></td>
                    <td className="px-3 py-2 text-secondary">{c.bankId ? bankName.get(c.bankId) ?? "" : "Default"}</td>
                    <td className={`tabular px-3 py-2 text-right ${c.direction === "RECEIVED" ? "" : "text-secondary"}`}>{c.direction === "RECEIVED" ? "" : "−"}{aed(Number(c.amount))}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[c.status] ?? ""}`}>{c.status === "PENDING" ? "Waiting" : c.status[0] + c.status.slice(1).toLowerCase()}{c.clearedOn ? ` ${fmtDate(c.clearedOn)}` : ""}</span></td>
                    <td className="px-4 py-1.5">{ctx.canWrite && <ChequeActions id={c.id} number={c.number} status={c.status} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
