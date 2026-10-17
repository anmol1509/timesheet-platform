import { Banknote } from "lucide-react";
import { payrollCompanyId, PAYROLL_COMPANY_SELECT } from "@/lib/payrollCompany";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { CreateRunForm } from "./create-run-form";
import { CostTrend } from "./cost-trend";
import { Insights } from "@/components/ListSummary";
import { isUsableBank } from "@/lib/bankStatus";
import { payDataGap } from "@/lib/payroll";
import { ApprovalRuleForm } from "./approval-rule";
import { Hint } from "@/components/Hint";
import { PayrollSetup, type SetupStep } from "./payroll-setup";
import { HeaderDialog, PayRuns, SetupBanner, type RunRow } from "./payroll-home";
import { StatTile } from "@/components/StatTile";
import { ListChecks, Wallet, CalendarCheck } from "lucide-react";
import { DueDaysForm } from "./due-days-form";
import { dueDateFor, dueState } from "@/lib/payrollSchedule";

export const metadata = { title: "Payroll" };

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

  const notStarted = companies.filter((c) => !runs.some((r) => r.month === defaultMonth && r.companyId === c.id));
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

  const fmtMonth = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  const dueText = (r: (typeof runs)[number]) => {
    const due = r.dueDate ?? dueDateFor(r.month, branch?.payrollDueDays);
    return due ? { text: due.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }), late: r.status !== "PAID" && dueState(due).overdue ? dueState(due).daysLate : 0 } : { text: null, late: 0 };
  };
  const runRows: RunRow[] = [
    // A month that has not been started for an own company yet is a row too, so "start it" sits where the runs are.
    ...(can(subject, "payroll.payroll", "create") ? notStarted.map((c): RunRow => ({ key: `new-${c.id}`, id: null, month: defaultMonth, monthLabel: fmtMonth(defaultMonth), companyId: c.id, company: c.name, status: "NOT_STARTED", due: null, overdueDays: 0, people: 0, net: 0 })) : []),
    ...runs.map((r): RunRow => {
      const d = dueText(r);
      return { key: r.id, id: r.id, month: r.month, monthLabel: fmtMonth(r.month), companyId: r.companyId, company: r.company?.name ?? "All own companies", status: r.status === "PAID" ? "PAID" : r.status === "APPROVED" ? "APPROVED" : r.submittedAt ? "SUBMITTED" : "DRAFT", due: d.text, overdueDays: d.late, people: r.lines.length, net: r.lines.reduce((sum, l) => sum + Number(l.net), 0) };
    }),
  ];
  const paidThisYear = runs.filter((r) => r.status === "PAID" && r.month.startsWith(String(now.getUTCFullYear())));
  const paidTotal = paidThisYear.reduce((n, r) => n + r.lines.reduce((sum, l) => sum + Number(l.net), 0), 0);
  const lastPaid = runs.find((r) => r.status === "PAID");
  const todoCount = runRows.filter((r) => r.status !== "PAID").length;
  const setupLeft = steps.filter((s) => !s.done && s.key !== "run").length;
  const setupSummary = [...(missingId.length ? [`MOHRE ID missing for ${missingId.slice(0, 2).map((x) => x.c.name).join(", ")}${missingId.length > 2 ? ` and ${missingId.length - 2} more` : ""}`] : []), ...(missingBank.length ? [`No bank that pays salaries for ${missingBank.slice(0, 2).map((x) => x.c.name).join(", ")}${missingBank.length > 2 ? ` and ${missingBank.length - 2} more` : ""}`] : []), ...(peopleTotal > 0 && peopleReady < peopleTotal ? [`${peopleTotal - peopleReady} of ${peopleTotal} workers need pay set`] : [])].join(" · ");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll"
        icon={Banknote}
        description="Pay your people each month: start the run, check the numbers, get it approved, then download the bank file."
        actions={
          branchId ? (
            <div className="flex flex-wrap items-center gap-2">
              {can(subject, "payroll.payroll", "approve") && (
                <HeaderDialog label="Payroll settings" title="Payroll settings" description="Who approves a run, and when pay is due.">
                  <div className="divide-y divide-[var(--border)]"><ApprovalRuleForm current={branch?.payrollApprovalThreshold ? Number(branch.payrollApprovalThreshold) : null} /><DueDaysForm current={branch?.payrollDueDays ?? null} /></div>
                </HeaderDialog>
              )}
              {can(subject, "payroll.payroll", "create") && (
                <HeaderDialog label="Start a payroll run" title="Start a payroll run" description="We work out everyone's pay from attendance or timesheets. You can check and change it before anything is final." primary icon>
                  <CreateRunForm bare defaultMonth={defaultMonth} companies={companies.map((c) => ({ id: c.id, name: c.name }))} />
                </HeaderDialog>
              )}
            </div>
          ) : undefined
        }
      />

      {!branchId && <p className="text-sm text-muted">Pick a branch from the switcher to see or create payroll runs.</p>}

      {branchId && setupLeft > 0 && (
        <SetupBanner remaining={setupLeft} summary={setupSummary}>
          <PayrollSetup steps={steps} bare />
          {setup.length > 0 && (
            <div className="mt-5 overflow-x-auto rounded-card border border-default">
              <table className="w-full text-sm">
                <thead className="bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted"><tr><th className="px-4 py-2">Company</th><th className="px-3 py-2 text-right">Pay details</th><th className="px-3 py-2">MOHRE ID<Hint term="MOHRE" /></th><th className="px-3 py-2">Salary bank<Hint term="PAYER_BANK" /></th></tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {setup.map(({ c, total, ready, establishment, bank }) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5"><Link href={`/suppliers/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link></td>
                      <td className="px-3 py-2.5 text-right tabular-nums"><span className={ready < total ? "text-[var(--warning)]" : "text-secondary"}>{ready} of {total}</span></td>
                      <td className="px-3 py-2.5">{establishment ? <span className="text-secondary">{establishment}</span> : <Link href={`/suppliers/${c.id}`} className="text-xs font-medium text-[var(--warning)] hover:underline">Add →</Link>}</td>
                      <td className="px-3 py-2.5">{bank ? <span className="text-secondary">{bank.accountName}</span> : <Link href="/banks" className="text-xs font-medium text-[var(--warning)] hover:underline">Add an active bank →</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SetupBanner>
      )}

      {branchId && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="To do now" value={todoCount} icon={ListChecks} tone={todoCount > 0 ? "warning" : "default"} hint={todoCount === 0 ? "nothing waiting" : `${runRows.filter((r) => r.status === "APPROVED").length} to pay · ${runRows.filter((r) => r.status === "NOT_STARTED").length} to start · ${runRows.filter((r) => r.status === "DRAFT" || r.status === "SUBMITTED").length} to finish`} />
          <StatTile label="Paid this year" value={`AED ${Math.round(paidTotal).toLocaleString("en-AE")}`} icon={Wallet} hint={`${paidThisYear.length} run${paidThisYear.length === 1 ? "" : "s"}`} />
          <StatTile label="Last paid run" value={lastPaid ? fmtMonth(lastPaid.month) : "—"} icon={CalendarCheck} hint={lastPaid?.company?.name ?? "none yet"} />
        </div>
      )}

      {runs.length >= 2 && <Insights id="payroll" title="Payroll cost trend" hint="Net pay by month"><CostTrend runs={runs.map((r) => ({ month: r.month, total: r.lines.reduce((s, l) => s + Number(l.net), 0), headcount: r.lines.length }))} /></Insights>}

      {branchId && <PayRuns rows={runRows} canCreate={can(subject, "payroll.payroll", "create")} />}
    </div>
  );
}
