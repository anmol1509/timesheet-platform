import Link from "next/link";
import { prisma } from "@/lib/db";
import { BUCKETS, BUCKET_LABEL, ageParties, ageTotals, termsDays, type AgeRow, type Bucket } from "@/lib/books/ageing";
import { CF_LABEL, cashFlow, type CfKey } from "@/lib/books/cashflow";
import { isMoneyAccount } from "@/lib/books/ledger";
import { profitByClient } from "@/lib/books/projectProfit";
import { aed, fmtDate } from "../books-data";

const BUCKET_TONE: Record<Bucket, string> = { current: "var(--success, #16a34a)", d30: "#ca8a04", d60: "#ea580c", d90: "#dc2626", over: "#991b1b" };
const dash = (n: number) => (n ? aed(n) : "–");

/** Receivables or payables: who is owed what and how late, oldest first. */
export async function AgeingView({ branchId, asOf, side }: { branchId: string; asOf: Date; side: "RECEIVABLE" | "PAYABLE" }) {
  const rec = side === "RECEIVABLE";
  const lines = await prisma.journalLine.findMany({
    where: { account: { branchId, tag: side }, entry: { branchId, status: "POSTED", date: { lte: asOf } } },
    select: { debit: true, credit: true, partyId: true, entry: { select: { date: true } } },
  });
  const ids = [...new Set(lines.map((l) => l.partyId).filter((x): x is string => !!x))];
  const parties = ids.length
    ? rec
      ? await prisma.client.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, paymentTerms: true } })
      : await prisma.supplier.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, paymentTerms: true } })
    : [];
  const info = new Map(parties.map((p) => [p.id, p]));
  const rows = ageParties(
    lines.map((l) => ({ date: l.entry.date, debit: Number(l.debit), credit: Number(l.credit), partyId: l.partyId })),
    asOf, rec ? "debit" : "credit",
    (id) => termsDays(id ? info.get(id)?.paymentTerms : null),
  );
  const t = ageTotals(rows);
  const late = rows.filter((r) => r.buckets.d90 + r.buckets.over > 0).sort((a, b) => b.buckets.d90 + b.buckets.over - (a.buckets.d90 + a.buckets.over));
  const name = (r: AgeRow) => (r.partyId ? info.get(r.partyId)?.name ?? "Unknown" : "Opening balance (not split by name)");
  const href = (r: AgeRow) => (r.partyId ? `/finance/books/parties/${rec ? "CLIENT" : "SUPPLIER"}/${r.partyId}` : null);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {BUCKETS.map((k) => (
          <div key={k} className="rounded-[var(--radius-card)] border border-default bg-surface p-4" style={{ borderTop: `3px solid ${BUCKET_TONE[k]}` }}>
            <p className="text-xs text-muted">{BUCKET_LABEL[k]}</p>
            <p className="tabular mt-1 text-lg font-semibold text-primary">{aed(t.buckets[k])}</p>
          </div>
        ))}
      </div>
      <section className="overflow-x-auto rounded-[var(--radius-card)] border border-default bg-surface">
        <h3 className="flex items-center justify-between bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-primary">
          <span>{rec ? "Who owes you" : "Who you owe"} as of {fmtDate(asOf)}</span><span className="tabular">{aed(t.total)}</span>
        </h3>
        {rows.length === 0 ? <p className="px-4 py-6 text-sm text-muted">Nothing outstanding.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr>
              <th className="px-4 py-2 font-medium">{rec ? "Client" : "Supplier"}</th>
              {BUCKETS.map((k) => <th key={k} className="px-3 py-2 text-right font-medium">{BUCKET_LABEL[k]}</th>)}
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr></thead>
            <tbody className="divide-y divide-default">
              {rows.map((r) => {
                const link = href(r);
                return (
                  <tr key={r.partyId ?? "none"}>
                    <td className="px-4 py-2 font-medium text-primary">{link ? <Link href={link} className="hover:underline">{name(r)}</Link> : name(r)}{r.unapplied > 0 && <span className="ml-2 rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] font-normal text-muted">{aed(r.unapplied)} unapplied</span>}</td>
                    {BUCKETS.map((k) => <td key={k} className={`tabular px-3 py-2 text-right ${(k === "d90" || k === "over") && r.buckets[k] ? "font-semibold text-error" : r.buckets[k] ? "text-secondary" : "text-subtle"}`}>{dash(r.buckets[k])}</td>)}
                    <td className="tabular px-4 py-2 text-right font-semibold text-primary">{aed(r.total)}</td>
                  </tr>
                );
              })}
              <tr className="font-semibold"><td className="px-4 py-2">Total</td>{BUCKETS.map((k) => <td key={k} className="tabular px-3 py-2 text-right">{dash(t.buckets[k])}</td>)}<td className="tabular px-4 py-2 text-right">{aed(t.total)}</td></tr>
            </tbody>
          </table>
        )}
      </section>
      {late.length > 0 && (
        <p className="rounded-[var(--radius-card)] border border-default bg-surface px-4 py-3 text-sm text-secondary">
          <span className="font-medium text-primary">{late[0].partyId ? info.get(late[0].partyId)?.name : "Opening balance"}</span> {rec ? "is" : "is owed"} {aed(late[0].buckets.d90 + late[0].buckets.over)} more than 60 days late{late.length > 1 ? `, and ${late.length - 1} more ${late.length === 2 ? "is" : "are"} over 60 days` : ""}.
        </p>
      )}
      <p className="text-xs text-muted">Aged from the invoice date plus the {rec ? "client" : "supplier"}&apos;s payment terms (30 days when none is set). Payments settle the oldest {rec ? "invoices" : "bills"} first.</p>
    </div>
  );
}

function CfSection({ title, rows, total, label }: { title: string; rows: { key: string; label: string; value: number }[]; total: number; label: string }) {
  return (
    <section className="overflow-x-auto rounded-[var(--radius-card)] border border-default bg-surface">
      <h3 className="bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-primary">{title}</h3>
      <table className="w-full text-sm"><tbody className="divide-y divide-default">
        {rows.map((r) => <tr key={r.key}><td className="px-4 py-1.5 text-secondary">{r.label}</td><td className={`tabular px-4 py-1.5 text-right ${r.value < 0 ? "text-error" : ""}`}>{aed(r.value)}</td></tr>)}
        <tr className="font-semibold"><td className="px-4 py-2">{label}</td><td className={`tabular px-4 py-2 text-right ${total < 0 ? "text-error" : ""}`}>{aed(total)}</td></tr>
      </tbody></table>
    </section>
  );
}

/** Where the cash came from and went, from the bank and cash accounts. */
export async function CashFlowView({ branchId, from, asOf }: { branchId: string; from: Date; asOf: Date }) {
  const accounts = await prisma.account.findMany({ where: { branchId }, select: { id: true, type: true, tag: true, name: true, bankId: true } });
  const money = new Set(accounts.filter(isMoneyAccount).map((a) => a.id));
  const entries = await prisma.journalEntry.findMany({
    where: { branchId, status: "POSTED", date: { lte: asOf }, lines: { some: { accountId: { in: [...money] } } } },
    select: { date: true, type: true, lines: { select: { debit: true, credit: true, account: { select: { id: true, type: true, tag: true } } } } },
  });
  const cf = (list: typeof entries) => cashFlow(list.map((e) => ({ type: e.type, lines: e.lines.map((l) => ({ money: money.has(l.account.id), debit: Number(l.debit), credit: Number(l.credit), accountType: l.account.type, tag: l.account.tag })) })));
  const opening = entries.filter((e) => e.date < from).reduce((s, e) => s + e.lines.filter((l) => money.has(l.account.id)).reduce((n, l) => n + Number(l.debit) - Number(l.credit), 0), 0);
  const c = cf(entries.filter((e) => e.date >= from));
  const row = (k: CfKey) => ({ key: k, label: CF_LABEL[k], value: c.rows[k] });
  const close = Math.round((opening + c.net) * 100) / 100;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[["Cash at start", opening], ["Money in less out", c.net], ["Cash at end", close]].map(([l, v]) => (
          <div key={l as string} className="rounded-[var(--radius-card)] border border-default bg-surface p-4"><p className="text-xs text-muted">{l as string}</p><p className={`tabular mt-1 text-lg font-semibold ${(v as number) < 0 ? "text-error" : "text-primary"}`}>{aed(v as number)}</p></div>
        ))}
      </div>
      <CfSection title={`Day-to-day business, ${fmtDate(from)} – ${fmtDate(asOf)}`} rows={(["clients", "suppliers", "salaries", "otherOperating"] as CfKey[]).map(row)} total={c.operating} label="Cash from operations" />
      <div className="grid gap-4 lg:grid-cols-2">
        <CfSection title="Buying equipment and property" rows={[row("assets")]} total={c.investing} label="Cash from investing" />
        <CfSection title="Owners and lenders" rows={[row("capital")]} total={c.financing} label="Cash from financing" />
      </div>
      <p className="text-xs text-muted">Built from every movement in your bank and cash accounts, so it always agrees with the balance sheet. Transfers between your own accounts are left out.</p>
    </div>
  );
}

/** Profit by client and project: revenue from invoices, costs from the project they were tagged to. */
export async function ProjectProfitView({ branchId, from, asOf }: { branchId: string; from: Date; asOf: Date }) {
  const entries = await prisma.journalEntry.findMany({
    where: { branchId, status: "POSTED", date: { gte: from, lte: asOf } },
    select: { lines: { select: { debit: true, credit: true, partyType: true, partyId: true, projectId: true, account: { select: { type: true, tag: true } } } } },
  });
  const projectIds = [...new Set(entries.flatMap((e) => e.lines.map((l) => l.projectId)).filter((x): x is string => !!x))];
  const projects = projectIds.length ? await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true, code: true, clientId: true } }) : [];
  const pById = new Map(projects.map((p) => [p.id, p]));
  const result = profitByClient(entries.map((e) => ({ lines: e.lines.map((l) => ({ accountType: l.account.type, tag: l.account.tag, debit: Number(l.debit), credit: Number(l.credit), partyType: l.partyType, partyId: l.partyId, projectId: l.projectId })) })), (id) => pById.get(id)?.clientId ?? null);
  const clientIds = result.clients.map((c) => c.clientId).filter((x): x is string => !!x);
  const clients = clientIds.length ? await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }) : [];
  const cName = new Map(clients.map((c) => [c.id, c.name]));
  const pct = (profit: number, revenue: number) => (revenue > 0 ? `${((profit / revenue) * 100).toFixed(1)}%` : "–");
  const tone = (profit: number) => (profit < 0 ? "text-error" : "text-success");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Revenue", result.revenue], ["Project costs", result.projectCosts], ["Company-wide costs", result.companyCosts], [result.profit < 0 ? "Loss" : "Profit", result.profit]].map(([l, v]) => (
          <div key={l as string} className="rounded-[var(--radius-card)] border border-default bg-surface p-4"><p className="text-xs text-muted">{l as string}</p><p className={`tabular mt-1 text-lg font-semibold ${l === "Profit" ? "text-success" : l === "Loss" ? "text-error" : "text-primary"}`}>{aed(v as number)}</p></div>
        ))}
      </div>
      <section className="overflow-x-auto rounded-[var(--radius-card)] border border-default bg-surface">
        <h3 className="bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-primary">By client and project, {fmtDate(from)} – {fmtDate(asOf)}</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Client / project</th><th className="px-3 py-2 text-right font-medium">Revenue</th><th className="px-3 py-2 text-right font-medium">Salaries</th><th className="px-3 py-2 text-right font-medium">Other costs</th><th className="px-3 py-2 text-right font-medium">Profit</th><th className="px-4 py-2 text-right font-medium">Margin</th></tr></thead>
          <tbody className="divide-y divide-default">
            {result.clients.map((c) => {
              const sal = c.projects.reduce((s, p) => s + p.salaries, 0), oth = c.projects.reduce((s, p) => s + p.otherCosts, 0), profit = c.revenue - sal - oth;
              return [
                <tr key={c.clientId ?? "none"} className="bg-[var(--surface-sunken)]/50 font-medium text-primary"><td className="px-4 py-2">{c.clientId ? cName.get(c.clientId) ?? "Unknown client" : "Revenue with no client"}</td><td className="tabular px-3 py-2 text-right">{dash(c.revenue)}</td><td className="tabular px-3 py-2 text-right">{dash(sal)}</td><td className="tabular px-3 py-2 text-right">{dash(oth)}</td><td className={`tabular px-3 py-2 text-right ${tone(profit)}`}>{aed(profit)}</td><td className="tabular px-4 py-2 text-right">{pct(profit, c.revenue)}</td></tr>,
                ...c.projects.map((p) => <tr key={p.projectId}><td className="py-1.5 pl-9 pr-4 text-secondary">{pById.get(p.projectId)?.name ?? "Project"}</td><td className="px-3 py-1.5 text-right text-subtle">–</td><td className="tabular px-3 py-1.5 text-right">{dash(p.salaries)}</td><td className="tabular px-3 py-1.5 text-right">{dash(p.otherCosts)}</td><td className="tabular px-3 py-1.5 text-right text-secondary">{aed(-(p.salaries + p.otherCosts))}</td><td className="px-4 py-1.5" /></tr>),
              ];
            })}
            <tr><td className="px-4 py-2 text-secondary">Company-wide costs (no project)</td><td /><td /><td className="tabular px-3 py-2 text-right">{dash(result.companyCosts)}</td><td className="tabular px-3 py-2 text-right text-secondary">{aed(-result.companyCosts)}</td><td /></tr>
            <tr className="font-semibold"><td className="px-4 py-2">Total</td><td className="tabular px-3 py-2 text-right">{aed(result.revenue)}</td><td /><td className="tabular px-3 py-2 text-right">{aed(result.projectCosts + result.companyCosts)}</td><td className={`tabular px-3 py-2 text-right ${tone(result.profit)}`}>{aed(result.profit)}</td><td className="tabular px-4 py-2 text-right">{pct(result.profit, result.revenue)}</td></tr>
          </tbody>
        </table>
      </section>
      <p className="text-xs text-muted">Invoices are per client, so revenue sits on the client row; salaries and expenses tagged to a project sit under it. The total matches the profit &amp; loss. Tag expenses to a project to see them here.</p>
    </div>
  );
}
