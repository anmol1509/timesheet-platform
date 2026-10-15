import { Banknote } from "lucide-react";
import { payrollCompanyId, PAYROLL_COMPANY_SELECT } from "@/lib/payrollCompany";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { Badge, type BadgeColor } from "@/components/Badge";
import { CreateRunForm } from "./create-run-form";
import { CostTrend } from "./cost-trend";
import { Insights } from "@/components/ListSummary";
import { isUsableBank } from "@/lib/bankStatus";
import { payDataGap } from "@/lib/payroll";
import { ApprovalRuleForm } from "./approval-rule";
import { Hint } from "@/components/Hint";
import { PayrollSetup, type SetupStep } from "./payroll-setup";
import { DueDaysForm } from "./due-days-form";
import { dueDateFor, dueState } from "@/lib/payrollSchedule";

export const metadata = { title: "Payroll" };

const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  DRAFT: { label: "Draft", color: "amber" },
  APPROVED: { label: "Approved", color: "blue" },
  PAID: { label: "Paid", color: "green" },
};
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function PayrollPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const [runs, branch, companies, ownEmployees, allBanks] = await Promise.all([
    prisma.payrollRun.findMany({
      where: branchWhere(branchId),
      orderBy: { month: "desc" },
      take: 36,
      include: { lines: { select: { net: true } }, branch: { select: { code: true } }, company: { select: { name: true } } },
    }),
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, include: { wpsPayerBank: true } }) : null,
    branchId ? prisma.supplier.findMany({ where: { branchId, isOwnCompany: true }, select: { id: true, name: true, payType: true, wpsEstablishmentId: true }, orderBy: { name: "asc" } }) : [],
    branchId ? prisma.employee.findMany({ where: { branchId, status: { not: "TERMINATED" }, supplier: { isOwnCompany: true } }, select: { ...PAYROLL_COMPANY_SELECT, payStructure: true, basicSalary: true, flatMonthlyRate: true, hourlyRate: true } }) : [],
    branchId ? prisma.bank.findMany({ where: { branchId, status: "ACTIVE" } }) : [],
  ]);

  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const defaultMonth = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  const usableBanks = allBanks.filter((b) => isUsableBank(b) && b.routingCode);

  // One line of setup per own company: can a run be created and, later, paid by WPS?
  const setup = companies.map((c) => {
        const emps = ownEmployees.filter((e) => payrollCompanyId(e) === c.id);
    const ready = emps.filter((e) => !payDataGap(null, { payStructure: e.payStructure, basicSalary: Number(e.basicSalary ?? 0), flatMonthlyRate: Number(e.flatMonthlyRate ?? 0), hourlyRate: Number(e.hourlyRate ?? 0) })).length;
    const bank = usableBanks.find((b) => b.companyId === c.id) ?? (branch?.wpsPayerBank && isUsableBank(branch.wpsPayerBank) && branch.wpsPayerBank.routingCode ? branch.wpsPayerBank : null);
    return { c, total: emps.length, ready, establishment: c.wpsEstablishmentId ?? branch?.wpsEstablishmentId ?? null, bank };
  });

  const monthLabel = new Date(`${defaultMonth}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const notStarted = companies.filter((c) => !runs.some((r) => r.month === defaultMonth && r.companyId === c.id));
  const unpaid = runs.filter((r) => r.status !== "PAID");
  const missingId = setup.filter((x) => !x.establishment);
  const missingBank = setup.filter((x) => !x.bank);
  const peopleTotal = setup.reduce((n, x) => n + x.total, 0);
  const peopleReady = setup.reduce((n, x) => n + x.ready, 0);
  const steps: SetupStep[] = [
    { key: "company", title: "Mark your company as an own company", why: "Payroll is only for your own companies' employees. Open a company under Suppliers and tick “Own company”.", done: companies.length > 0, href: "/suppliers", action: "Open suppliers" },
    { key: "mohre", title: "Add the labour ministry ID (MOHRE)", hint: "MOHRE", why: "The bank file needs your company's MOHRE establishment ID. It is on your labour ministry documents.", done: companies.length > 0 && missingId.length === 0, detail: missingId.length > 0 ? `Missing for ${missingId.slice(0, 2).map((x) => x.c.name).join(", ")}${missingId.length > 2 ? ` and ${missingId.length - 2} more` : ""}.` : undefined, href: missingId[0] ? `/suppliers/${missingId[0].c.id}` : "/suppliers", action: "Add ID" },
    { key: "bank", title: "Add the bank that pays salaries", hint: "PAYER_BANK", why: "Add the company bank account that salaries are paid from, with its routing code and IBAN, and mark it active.", done: companies.length > 0 && missingBank.length === 0, detail: missingBank.length > 0 ? `Missing for ${missingBank.slice(0, 2).map((x) => x.c.name).join(", ")}${missingBank.length > 2 ? ` and ${missingBank.length - 2} more` : ""}.` : undefined, href: "/banks", action: "Add bank" },
    { key: "pay", title: "Set how each worker is paid", hint: "PAY_STRUCTURE", why: "Each worker needs a pay structure and amount, on their Trade & pay tab. Workers without one are left out of the run.", done: peopleTotal > 0 && peopleReady === peopleTotal, detail: peopleTotal > 0 && peopleReady < peopleTotal ? `${peopleTotal - peopleReady} of ${peopleTotal} workers still need pay set.` : peopleTotal === 0 ? "No workers belong to your own companies yet." : undefined, href: "/employees", action: "Open workers" },
    { key: "run", title: "Start your first payroll run", why: "Choose the company and month below and press “Start payroll run”. You can check everything before it is final.", done: runs.length > 0 },
  ];
  const setupGaps = setup.some((x) => x.ready < x.total || !x.establishment || !x.bank);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll"
        icon={Banknote}
        description="Pay your people each month: start the run, check the numbers, get it approved, then download the bank file."
      />

      {branchId && <PayrollSetup steps={steps} />}

      {branchId && (unpaid.length > 0 || notStarted.length > 0) && (
        <section className="card border border-[var(--info-border)] bg-[var(--info-soft)] p-4" aria-label="What to do now">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">What to do now</p>
          {unpaid.slice(0, 3).map((r) => (
            <p key={r.id} className="mt-1 text-sm text-secondary">
              <span className="font-medium text-primary">{r.company?.name ?? "Payroll"} · {r.month}</span> is {r.status === "DRAFT" ? (r.submittedAt ? "waiting for approval" : "still a draft") : "approved and waiting to be paid"}.{" "}
              {(() => { const due = r.dueDate ?? dueDateFor(r.month, branch?.payrollDueDays); const st = due ? dueState(due) : null; return st?.overdue ? <span className="font-medium text-[var(--error)]">{st.daysLate} day{st.daysLate === 1 ? "" : "s"} past the due date. </span> : null; })()}
              <Link href={`/payroll/${r.id}`} className="font-medium text-[var(--brand-primary)] hover:underline">Open →</Link>
            </p>
          ))}
          {notStarted.length > 0 && can(subject, "payroll.payroll", "create") && (
            <p className="mt-1 text-sm text-secondary"><span className="font-medium text-primary">{monthLabel} payroll hasn&apos;t been started</span> for {notStarted.slice(0, 3).map((c) => c.name).join(", ")}{notStarted.length > 3 ? ` and ${notStarted.length - 3} more` : ""}. Use “Start a payroll run” below.</p>
          )}
        </section>
      )}

      {branchId && setup.length > 0 && (
        <details className="card overflow-x-auto">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-primary">Company setup {setupGaps ? <span className="ml-2 text-xs font-normal text-[var(--warning)]">needs attention</span> : <span className="ml-2 text-xs font-normal text-[var(--success)]">all set</span>}</summary>
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium uppercase tracking-wide text-muted"><tr><th className="px-5 py-2">Company</th><th className="px-3 py-2 text-right">Pay details complete</th><th className="px-3 py-2">Labour ministry ID (MOHRE)<Hint term="MOHRE" /></th><th className="px-3 py-2">Bank that pays salaries<Hint term="PAYER_BANK" /></th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {setup.map(({ c, total, ready, establishment, bank }) => (
                <tr key={c.id}>
                  <td className="px-5 py-2.5"><Link href={`/suppliers/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link></td>
                  <td className="px-3 py-2.5 text-right tabular-nums"><span className={ready < total ? "text-[var(--warning)]" : "text-secondary"}>{ready} of {total}</span></td>
                  <td className="px-3 py-2.5">{establishment ? <span className="text-secondary">{establishment}</span> : <Link href={`/suppliers/${c.id}`} className="text-xs font-medium text-[var(--warning)] hover:underline">Add →</Link>}</td>
                  <td className="px-3 py-2.5">{bank ? <span className="text-secondary">{bank.accountName}</span> : <Link href="/banks" className="text-xs font-medium text-[var(--warning)] hover:underline">Add an active bank →</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {branchId ? (can(subject, "payroll.payroll", "create") && <CreateRunForm defaultMonth={defaultMonth} companies={companies.map((c) => ({ id: c.id, name: c.name }))} />) : (
        <p className="text-sm text-muted">Pick a branch from the switcher to create a payroll run.</p>
      )}

      {branchId && can(subject, "payroll.payroll", "approve") && (
        <details className="card"><summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-primary">Payroll settings</summary><div className="divide-y divide-[var(--border)] border-t border-default"><ApprovalRuleForm current={branch?.payrollApprovalThreshold ? Number(branch.payrollApprovalThreshold) : null} /><DueDaysForm current={branch?.payrollDueDays ?? null} /></div></details>
      )}

      {runs.length >= 2 && <Insights id="payroll" title="Payroll cost trend" hint="Net pay by month"><CostTrend runs={runs.map((r) => ({ month: r.month, total: r.lines.reduce((s, l) => s + Number(l.net), 0), headcount: r.lines.length }))} /></Insights>}

      {runs.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No payroll runs yet. Choose a company and month above and press “Start payroll run”.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Company</th>
                {!branchId && <th className="px-4 py-3">Branch</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Employees</th>
                <th className="px-4 py-3 text-right">Total net (AED)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium"><Link href={`/payroll/${r.id}`} className="text-primary hover:underline">{r.month}</Link></td>
                  <td className="px-4 py-3 text-secondary">{r.company?.name ?? <span className="text-subtle">All own companies</span>}{r.payType && <span className="ml-2 text-xs text-muted">{r.payType === "HOURLY" ? "hourly" : "basic"}</span>}</td>
                  {!branchId && <td className="px-4 py-3 text-secondary">{r.branch.code}</td>}
                  <td className="px-4 py-3"><Badge color={STATUS[r.status]?.color ?? "slate"} dot>{STATUS[r.status]?.label ?? r.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-secondary">{(() => { const due = r.dueDate ?? dueDateFor(r.month, branch?.payrollDueDays); if (!due) return <span className="text-subtle">—</span>; const st = dueState(due); return <>{due.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}{r.status !== "PAID" && st.overdue && <Badge color="red" className="ml-2">{st.daysLate}d late</Badge>}</>; })()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-secondary">{r.lines.length}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-primary">{aed(r.lines.reduce((s, l) => s + Number(l.net), 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
