import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { Badge, type BadgeColor } from "@/components/Badge";
import { SettlementEditor, SettlementButtons } from "./editor";
import { ReceiptButton } from "../../loans/receipt-button";
import { PrintButton } from "../../[id]/payslips/print-button";

export const metadata = { title: "Final settlement" };

const STATUS: Record<string, { label: string; color: BadgeColor }> = { DRAFT: { label: "Draft", color: "amber" }, APPROVED: { label: "Approved", color: "blue" }, PAID: { label: "Paid", color: "green" } };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (d: { toString(): string }) => Number(d.toString());
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const dmy = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "UTC" });

export default async function SettlementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const s = await prisma.finalSettlement.findUnique({
    where: { id },
    include: { branch: { select: { name: true, address: true, emirate: true } }, employee: { select: { id: true, name: true, employeeIdNo: true, joinDate: true, trade: true, position: true, passportNumber: true, supplier: { select: { name: true, fullName: true } } } } },
  });
  if (!s || isOutsideBranch(s.branchId, branchId, isSuperAdmin)) notFound();
  const [creator, approver] = await Promise.all([
    prisma.user.findUnique({ where: { id: s.createdById }, select: { name: true } }),
    s.approvedById ? prisma.user.findUnique({ where: { id: s.approvedById }, select: { name: true } }) : null,
  ]);
  const company = s.employee.supplier?.fullName || s.employee.supplier?.name || s.branch.name;
  const earnings = [
    ["Gratuity", n(s.gratuity), `${s.serviceYears.toFixed(2)} years of service on a basic of AED ${aed(n(s.basic))}`],
    ["Salary for days worked, not yet paid", n(s.unpaidSalary), `${s.unpaidSalaryDays} day${s.unpaidSalaryDays === 1 ? "" : "s"}`],
    ["Leave pay", n(s.leavePay), ""],
    ["Notice pay", n(s.noticePay), ""],
    ["Other amounts due to the employee", n(s.otherEarnings), ""],
  ] as const;
  const deductions = [["Loans and advances outstanding", n(s.loanBalance), ""], ["Other amounts due from the employee", n(s.otherDeductions), s.notes ?? ""]] as const;
  const net = n(s.net);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href="/payroll/settlements" className="text-xs text-muted hover:text-secondary">← Final settlements</Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-primary">{s.employee.name} <Badge color={STATUS[s.status]?.color ?? "slate"} dot>{STATUS[s.status]?.label ?? s.status}</Badge></h1>
        </div>
        <div className="flex items-center gap-3"><ReceiptButton id={s.id} base={`/api/payroll/docs/settlement/${s.id}`} label="Settlement letter" hint="The final settlement as a letter to the employee, with an acknowledgement to sign. The wording comes from your Final Settlement Statement template (Letters › Templates)." /><PrintButton /></div>
      </div>

      {s.status === "DRAFT" && can(subject, "payroll.payroll", "edit") && (
        <SettlementEditor
          s={{ id: s.id, exitDate: ymd(s.exitDate), reason: s.reason ?? "Resigned", basic: n(s.basic), unpaidSalaryDays: s.unpaidSalaryDays, leavePay: n(s.leavePay), noticePay: n(s.noticePay), otherEarnings: n(s.otherEarnings), loanBalance: n(s.loanBalance), otherDeductions: n(s.otherDeductions), notes: s.notes ?? "" }}
        />
      )}
      <SettlementButtons id={s.id} status={s.status} canApprove={can(subject, "payroll.payroll", "approve")} canDelete={can(subject, "payroll.payroll", "delete")} />

      <article className="card mx-auto max-w-3xl space-y-5 p-6 text-sm print:border-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-default pb-3">
          <div><p className="text-base font-semibold text-primary">{company}</p><p className="text-xs text-muted">{[s.branch.address, s.branch.emirate].filter(Boolean).join(", ")}</p></div>
          <div className="text-right"><p className="text-base font-semibold text-primary">Final settlement</p><p className="text-xs text-muted">{STATUS[s.status]?.label}</p></div>
        </header>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div className="flex justify-between"><dt className="text-muted">Employee</dt><dd className="text-primary">{s.employee.name}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">ID</dt><dd className="text-primary">{s.employee.employeeIdNo}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Designation</dt><dd className="text-primary">{s.employee.trade ?? s.employee.position ?? "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Passport</dt><dd className="text-primary">{s.employee.passportNumber ?? "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Joined</dt><dd className="text-primary">{s.employee.joinDate ? dmy(s.employee.joinDate) : "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Last working day</dt><dd className="text-primary">{dmy(s.exitDate)}{s.reason ? ` · ${s.reason}` : ""}</dd></div>
        </dl>
        <table className="w-full">
          <thead><tr className="border-b border-default text-left text-xs uppercase tracking-wide text-muted"><th className="py-2">Amounts due to the employee</th><th className="py-2 text-right">AED</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {earnings.map(([label, amount, note]) => (<tr key={label}><td className="py-2 text-primary">{label}{note && <span className="block text-xs text-muted">{note}</span>}</td><td className="py-2 text-right tabular-nums">{aed(amount)}</td></tr>))}
          </tbody>
        </table>
        <table className="w-full">
          <thead><tr className="border-b border-default text-left text-xs uppercase tracking-wide text-muted"><th className="py-2">Deductions</th><th className="py-2 text-right">AED</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {deductions.map(([label, amount, note]) => (<tr key={label}><td className="py-2 text-primary">{label}{note && <span className="block text-xs text-muted">{note}</span>}</td><td className="py-2 text-right tabular-nums">{amount > 0 ? `−${aed(amount)}` : aed(0)}</td></tr>))}
          </tbody>
        </table>
        <div className={`flex items-baseline justify-between border-t-2 border-default pt-3 ${net < 0 ? "text-[var(--error)]" : "text-primary"}`}>
          <span className="text-base font-semibold">{net < 0 ? "Amount due from the employee" : "Net amount payable"}</span>
          <span className="tabular text-xl font-semibold">AED {aed(Math.abs(net))}</span>
        </div>
        <p className="text-xs text-muted">The gratuity is calculated under UAE labour law on the basic wage and is an estimate of the legal entitlement; check it against the employee&rsquo;s contract before paying.</p>
        <div className="grid grid-cols-3 gap-6 pt-8 text-xs">
          <div><div className="border-t border-default pt-1">Prepared by</div><p className="text-muted">{creator?.name ?? "—"}</p></div>
          <div><div className="border-t border-default pt-1">Approved by</div><p className="text-muted">{approver?.name ?? ""}</p></div>
          <div><div className="border-t border-default pt-1">Received by the employee</div><p className="text-muted">in full and final settlement</p></div>
        </div>
      </article>
    </div>
  );
}
