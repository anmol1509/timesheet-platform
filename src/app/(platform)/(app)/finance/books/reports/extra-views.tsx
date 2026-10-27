import Link from "next/link";
import { prisma } from "@/lib/db";
import { BUCKETS, BUCKET_LABEL, type AgeRow, type Bucket } from "@/lib/books/ageing";
import { CF_LABEL, type CfKey } from "@/lib/books/cashflow";
import { PROVISIONS, provisionAt, provisionTotals, type Policy } from "@/lib/books/accruals";
import { provisionTag, ruleTarget, type CustomRule, type RuleStaff } from "@/lib/books/customProvisions";
import { branchWhere } from "@/lib/branch";
import { EMIRATES, quarterOf, type Manual } from "@/lib/books/vat";
import { aed, fmtDate } from "../books-data";
import { loadAgeing, loadCashFlow, loadProjectProfit, loadVat } from "./report-data";

const BUCKET_TONE: Record<Bucket, string> = { current: "var(--success, #16a34a)", d30: "#ca8a04", d60: "#ea580c", d90: "#dc2626", over: "#991b1b" };
const dash = (n: number) => (n ? aed(n) : "–");

/** Receivables or payables: who is owed what and how late, oldest first. */
export async function AgeingView({ branchId, asOf, side }: { branchId: string; asOf: Date; side: "RECEIVABLE" | "PAYABLE" }) {
  const { rec, rows, t, late, info } = await loadAgeing(branchId, asOf, side);
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
  const { opening, c, close } = await loadCashFlow(branchId, from, asOf);
  const row = (k: CfKey) => ({ key: k, label: CF_LABEL[k], value: c.rows[k] });
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
  const { result, cName, pById } = await loadProjectProfit(branchId, from, asOf);
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

/** What is owed to staff for later, per person, set against what the books have set aside so far. */
export async function ProvisionsView({ branchId, asOf, on, policy }: { branchId: string; asOf: Date; on: { gratuity: boolean; leave: boolean; tickets: boolean }; policy: Policy }) {
  const [people, paid, ledger, ruleRows] = await Promise.all([
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), joinDate: { not: null } },
      select: { id: true, name: true, employeeIdNo: true, joinDate: true, exitDate: true, payStructure: true, basicSalary: true, housingAllowance: true, foodAllowance: true, transportAllowance: true, otherAllowance: true, flatMonthlyRate: true, leaveDaysPerYear: true, airTicketAmount: true, airTicketEveryMonths: true, skipGratuity: true, category: true },
      orderBy: { name: "asc" },
    }),
    prisma.finalSettlement.findMany({ where: { branchId, status: "PAID", paidAt: { not: null } }, select: { employeeId: true, paidAt: true } }),
    prisma.journalLine.groupBy({ by: ["accountId"], where: { account: { branchId, tag: { in: PROVISIONS.map((p) => p.provision) } }, entry: { branchId, status: "POSTED", date: { lte: asOf } } }, _sum: { debit: true, credit: true } }),
    prisma.provisionRule.findMany({ where: { branchId }, orderBy: { createdAt: "asc" } }),
  ]);
  const rules: CustomRule[] = ruleRows.map((r) => ({ id: r.id, name: r.name, method: r.method as CustomRule["method"], amount: Number(r.amount), everyMonths: r.everyMonths, appliesTo: r.appliesTo as CustomRule["appliesTo"], active: r.active }));
  const ruleTags = rules.map((r) => provisionTag(r.id));
  const accounts = await prisma.account.findMany({ where: { branchId, tag: { in: [...PROVISIONS.map((p) => p.provision), ...ruleTags] } }, select: { id: true, tag: true } });
  const ruleLedger = accounts.length ? await prisma.journalLine.groupBy({ by: ["accountId"], where: { accountId: { in: accounts.filter((a) => ruleTags.includes(a.tag as string)).map((a) => a.id) }, entry: { branchId, status: "POSTED", date: { lte: asOf } } }, _sum: { debit: true, credit: true } }) : [];
  const settled = new Map(paid.map((x) => [x.employeeId, x.paidAt as Date]));
  const everyone = people.map((e) => {
    const itemised = e.payStructure === "ITEMISED", flat = e.payStructure === "FLAT";
    const basic = itemised ? Number(e.basicSalary ?? 0) : flat ? Number(e.flatMonthlyRate ?? 0) : 0;
    const fixed = itemised ? basic + Number(e.housingAllowance ?? 0) + Number(e.foodAllowance ?? 0) + Number(e.transportAllowance ?? 0) + Number(e.otherAllowance ?? 0) : basic;
    const f: RuleStaff = { id: e.id, category: e.category, joinDate: e.joinDate, exitDate: e.exitDate, settledOn: settled.get(e.id) ?? null, basic, fixed, leaveDaysPerYear: e.leaveDaysPerYear, ticketAmount: e.airTicketAmount == null ? null : Number(e.airTicketAmount), ticketEveryMonths: e.airTicketEveryMonths, skipGratuity: e.skipGratuity };
    return { e, f, a: provisionAt(f, asOf, { gratuity: true, leave: true, tickets: true }, policy) };
  });
  const perPerson = rules.filter((r) => r.method !== "COMPANY");
  const facts = everyone.filter((r) => r.a.gratuity + r.a.leave + r.a.tickets > 0 || perPerson.some((x) => ruleTarget(x, [r.f], asOf) > 0));
  const total = provisionTotals(facts.map((r) => r.f), asOf, { gratuity: true, leave: true, tickets: true }, policy);
  const posted = (tag: string) => {
    const id = accounts.find((a) => a.tag === tag)?.id;
    const row = [...ledger, ...ruleLedger].find((l) => l.accountId === id);
    return row ? Number(row._sum.credit ?? 0) - Number(row._sum.debit ?? 0) : 0;
  };
  const ruleAmount = (r: CustomRule, f: RuleStaff) => ruleTarget(r, [f], asOf);
  const ruleTotal = (r: CustomRule) => ruleTarget(r, everyone.map((x) => x.f), asOf);
  const noContract = facts.filter((r) => (r.f.leaveDaysPerYear ?? policy.leave.defaultDays) == null && (r.f.ticketAmount ?? policy.tickets.defaultAmount) == null).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PROVISIONS.map((p) => (
          <div key={p.key} className="rounded-[var(--radius-card)] border border-default bg-surface p-4">
            <p className="text-xs text-muted">{p.label}</p>
            <p className="tabular mt-1 text-lg font-semibold text-primary">{aed(total[p.key])}</p>
            <p className="mt-1 text-xs text-muted">{on[p.key] ? <>In the books: <span className="tabular">{aed(posted(p.provision))}</span></> : <>Not being set aside <Link href="/finance/books/setup" className="text-brand hover:underline">· turn on</Link></>}</p>
          </div>
        ))}
        {rules.map((r) => (
          <div key={r.id} className="rounded-[var(--radius-card)] border border-default bg-surface p-4">
            <p className="text-xs text-muted">{r.name}{r.active ? "" : " (off)"}</p>
            <p className="tabular mt-1 text-lg font-semibold text-primary">{aed(ruleTotal(r))}</p>
            <p className="mt-1 text-xs text-muted">In the books: <span className="tabular">{aed(posted(provisionTag(r.id)))}</span></p>
          </div>
        ))}
      </div>
      <section className="overflow-x-auto rounded-[var(--radius-card)] border border-default bg-surface">
        <h3 className="bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-primary">Owed to staff as of {fmtDate(asOf)}</h3>
        {facts.length === 0 ? <p className="px-4 py-6 text-sm text-muted">No one has a join date and pay set up yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Employee</th><th className="px-3 py-2 font-medium">Joined</th>{PROVISIONS.map((p) => <th key={p.key} className="px-3 py-2 text-right font-medium">{p.label}</th>)}{perPerson.map((r) => <th key={r.id} className="px-3 py-2 text-right font-medium">{r.name}</th>)}</tr></thead>
            <tbody className="divide-y divide-default">
              {facts.map((r) => (
                <tr key={r.e.id}>
                  <td className="px-4 py-1.5"><Link href={`/employees/${r.e.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{r.e.name}</Link><span className="ml-2 font-mono text-xs text-muted">{r.e.employeeIdNo}</span></td>
                  <td className="px-3 py-1.5 text-secondary">{r.f.joinDate ? fmtDate(r.f.joinDate) : ""}</td>
                  {PROVISIONS.map((p) => <td key={p.key} className="tabular px-3 py-1.5 text-right">{dash(r.a[p.key])}</td>)}{perPerson.map((x) => <td key={x.id} className="tabular px-3 py-1.5 text-right">{dash(ruleAmount(x, r.f))}</td>)}
                </tr>
              ))}
              <tr className="font-semibold"><td className="px-4 py-2" colSpan={2}>Total</td>{PROVISIONS.map((p) => <td key={p.key} className="tabular px-3 py-2 text-right">{aed(total[p.key])}</td>)}{perPerson.map((r) => <td key={r.id} className="tabular px-3 py-2 text-right">{aed(ruleTotal(r))}</td>)}</tr>
            </tbody>
          </table>
        )}
      </section>
      <p className="text-xs text-muted">Worked out with your rules (Accounting › Settings › Staff provisions). Leave and tickets use each person&apos;s own terms (on their pay tab) or the company default{noContract ? `; ${noContract} ${noContract === 1 ? "person has" : "people have"} none, so only gratuity applies to them` : ""}. Month-end entries are posted once the month is over.</p>
    </div>
  );
}

const money = (n: number) => (n ? aed(n) : "–");

function VatRow({ box, label, amount, vat, bold }: { box: string; label: string; amount?: number; vat?: number; bold?: boolean }) {
  return (
    <tr className={bold ? "font-semibold" : ""}>
      <td className="w-14 px-4 py-1.5 font-mono text-xs text-muted">{box}</td>
      <td className="px-3 py-1.5 text-secondary">{label}</td>
      <td className="tabular px-3 py-1.5 text-right">{amount === undefined ? "" : money(amount)}</td>
      <td className="tabular px-4 py-1.5 text-right">{vat === undefined ? "" : money(vat)}</td>
    </tr>
  );
}

function VatHead({ title, cols }: { title: string; cols?: boolean }) {
  return (
    <thead><tr className="bg-[var(--surface-sunken)] text-left text-xs text-muted"><th className="px-4 py-2 font-semibold text-primary" colSpan={2}>{title}</th><th className="px-3 py-2 text-right font-medium">{cols ? "Amount (AED)" : ""}</th><th className="px-4 py-2 text-right font-medium">{cols ? "VAT (AED)" : ""}</th></tr></thead>
  );
}

/** The FTA VAT return (Form 201) worked out from the ledger, with room for what the books can't know. */
export async function VatReturnView({ branchId, from, asOf, manual }: { branchId: string; from: Date; asOf: Date; manual: Manual }) {
  const { r, branch } = await loadVat(branchId, from, asOf, manual);
  const now = new Date();
  const q0 = quarterOf(now), q1 = quarterOf(now, 1);
  const iso0 = from.toISOString().slice(0, 10), iso1 = asOf.toISOString().slice(0, 10);
  const manualQuery = ([["ex", manual.exempt], ["rs", manual.reverseSales], ["re", manual.reverseExpenses], ["ia", manual.importsAmount], ["iv", manual.importsVat]] as const).map(([k, v]) => (v ? `&${k}=${v}` : "")).join("");
  const field = (name: string, label: string, v: number | undefined) => <label key={name} className="text-xs text-muted">{label}<input name={name} inputMode="decimal" defaultValue={v ? String(v) : ""} className="input mt-1 block h-8 w-28 text-right text-sm" /></label>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs" data-print-hide>
        <span className="text-muted">Period:</span>
        {[q0, q1].map((q) => <Link key={q.label} href={`/finance/books/reports?view=vat&from=${q.from}&asof=${q.to}${manualQuery}`} className={`rounded-full border px-3 py-1 font-medium ${iso0 === q.from && iso1 === q.to ? "border-brand bg-brand-soft text-brand" : "border-default text-secondary hover:bg-surface-hover"}`}>{q.label}</Link>)}
      </div>
      <div className="rounded-[var(--radius-card)] border border-default bg-surface px-4 py-3 text-sm">
        <p className="font-semibold text-primary">{branch?.name}: VAT return (Form 201)</p>
        <p className="text-xs text-muted">Tax registration number: <span className="font-mono text-primary">{branch?.trn || "not set (add it under Reference Data › Company)"}</span> · {fmtDate(from)} – {fmtDate(asOf)} · registered in {r.emirate}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-x-auto rounded-[var(--radius-card)] border border-default bg-surface">
          <table className="w-full text-sm">
            <VatHead title="VAT on sales and all other outputs" cols />
            <tbody className="divide-y divide-default">
              {r.byEmirate.map((e, i) => <VatRow key={e.emirate} box={`1${"abcdefg"[i]}`} label={`Standard rated supplies in ${e.emirate}`} amount={e.amount} vat={e.vat} />)}
              <VatRow box="3" label="Supplies subject to the reverse charge" amount={r.reverseSales.amount} vat={r.reverseSales.vat} />
              <VatRow box="4" label="Zero rated supplies" amount={r.zeroRated} />
              <VatRow box="5" label="Exempt supplies" amount={r.exempt} />
              <VatRow box="6" label="Goods imported into the UAE" amount={r.imports.amount} vat={r.imports.vat} />
              <VatRow box="8" label="Total" amount={r.salesTotal.amount} vat={r.salesTotal.vat} bold />
            </tbody>
          </table>
        </section>
        <section className="overflow-x-auto rounded-[var(--radius-card)] border border-default bg-surface">
          <table className="w-full text-sm">
            <VatHead title="VAT on expenses and all other inputs" cols />
            <tbody className="divide-y divide-default">
              <VatRow box="9" label="Standard rated expenses" amount={r.expensesStandard.amount} vat={r.expensesStandard.vat} />
              <VatRow box="10" label="Supplies subject to the reverse charge" amount={r.reverseExpenses.amount} vat={r.reverseExpenses.vat} />
              <VatRow box="11" label="Total" amount={r.expensesTotal.amount} vat={r.expensesTotal.vat} bold />
            </tbody>
            <VatHead title="Net VAT due" />
            <tbody className="divide-y divide-default">
              <VatRow box="12" label="Total due tax for the period" vat={r.due} />
              <VatRow box="13" label="Total recoverable tax for the period" vat={r.recoverable} />
              <VatRow box="14" label={r.net >= 0 ? "Payable tax for the period" : "Refundable tax for the period"} vat={Math.abs(r.net)} bold />
            </tbody>
          </table>
        </section>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-default bg-surface p-4 text-sm" data-print-hide>
        <input type="hidden" name="view" value="vat" /><input type="hidden" name="from" value={iso0} /><input type="hidden" name="asof" value={iso1} />
        <p className="w-full text-xs text-muted">The books can&apos;t tell these apart, so type them in if you have any (amounts before VAT):</p>
        {field("ex", "Exempt supplies", manual.exempt)}
        {field("rs", "Reverse charge sales", manual.reverseSales)}
        {field("re", "Reverse charge purchases", manual.reverseExpenses)}
        {field("ia", "Imported goods", manual.importsAmount)}
        {field("iv", "VAT paid on imports", manual.importsVat)}
        <button className="h-8 rounded-lg border border-default px-3 font-medium text-primary hover:bg-surface-hover">Update</button>
      </form>
      <p className="text-xs text-muted">Sales are the sales income in the books: entries with output VAT are standard rated, the rest zero rated. Expenses are the costs on entries with input VAT. Check boxes against the FTA portal before filing; {EMIRATES.length} emirates are listed, your own is filled in.</p>
    </div>
  );
}
