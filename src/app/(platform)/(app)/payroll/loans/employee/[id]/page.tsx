import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { PageHeader } from "@/components/PageHeader";
import { Badge, type BadgeColor } from "@/components/Badge";
import { advanceRef, advanceState, methodLabel, planRows, readSchedule } from "@/lib/advances";
import { ReceiptButton } from "../../receipt-button";

export const metadata = { title: "Advance statement" };

const STATE_COLOR: Record<string, BadgeColor> = { PENDING: "amber", TO_GIVE: "blue", RECOVERING: "blue", CLEARED: "green", REJECTED: "red", CANCELLED: "slate" };
const aed = (v: number) => v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (d: { toString(): string }) => Number(d.toString());
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function AdvanceStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const emp = await prisma.employee.findUnique({ where: { id }, select: { id: true, name: true, employeeIdNo: true, trade: true, branchId: true } });
  if (!emp || isOutsideBranch(emp.branchId, branchId, isSuperAdmin)) notFound();
  const loans = await prisma.employeeLoan.findMany({ where: { employeeId: id }, orderBy: { createdAt: "desc" }, include: { repayments: { orderBy: { month: "asc" }, select: { month: true, amount: true } } } });
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set(loans.flatMap((l) => [l.createdById, l.approvedById].filter((x): x is string => !!x)))] } }, select: { id: true, name: true } });
  const nameOf = new Map(people.map((u) => [u.id, u.name]));

  const live = loans.filter((l) => l.approvalStatus === "APPROVED" && l.status !== "CANCELLED" && l.givenDate);
  const advanced = live.reduce((s, l) => s + n(l.principal), 0);
  const recovered = live.reduce((s, l) => s + n(l.repaid), 0);

  return (
    <div className="space-y-5">
      <PageHeader title={`Advances: ${emp.name}`} description={`${emp.employeeIdNo}${emp.trade ? ` · ${emp.trade}` : ""}`} breadcrumbs={[{ label: "Loans & advances", href: "/payroll/loans" }, { label: emp.name }]} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs text-muted">Given to them</p><p className="mt-1 text-2xl font-semibold text-primary tabular-nums">AED {aed(advanced)}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">Deducted so far</p><p className="mt-1 text-2xl font-semibold text-primary tabular-nums">AED {aed(recovered)}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">Still to deduct</p><p className="mt-1 text-2xl font-semibold text-primary tabular-nums">AED {aed(Math.max(0, advanced - recovered))}</p></div>
      </div>

      {loans.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">{emp.name} has no advances or loans. <Link href="/payroll/loans" className="text-[var(--brand-primary)] hover:underline">Request one</Link>.</p></div>
      ) : (
        <div className="space-y-4">
          {loans.map((l) => {
            const principal = n(l.principal);
            const schedule = readSchedule(l.schedule);
            const plan = planRows({ principal, instalment: n(l.instalment), startMonth: l.startMonth, schedule });
            const done = new Map(l.repayments.map((r) => [r.month, n(r.amount)]));
            const state = advanceState({ approvalStatus: l.approvalStatus, status: l.status, givenDate: l.givenDate, principal, repaid: n(l.repaid) });
            return (
              <section key={l.id} className="card overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">{advanceRef(l.refNo)} · {l.type === "LOAN" ? "Loan" : "Advance"} of AED {aed(principal)}</p>
                    {l.reason && <p className="text-xs text-muted">{l.reason}</p>}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge color={STATE_COLOR[state.key] ?? "slate"} dot>{state.label}</Badge>
                    {state.key !== "REJECTED" && state.key !== "CANCELLED" && <ReceiptButton id={l.id} label={l.givenDate ? "Receipt" : "Request letter"} icon={<FileText className="h-3 w-3" aria-hidden />} />}
                  </div>
                </header>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  <ol className="space-y-2 text-sm">
                    <li><span className="text-muted">Requested</span> {day(l.createdAt)} by {nameOf.get(l.createdById) ?? "—"}</li>
                    <li>
                      <span className="text-muted">Approval</span>{" "}
                      {l.approvalStatus === "PENDING" ? "Waiting for an approver" : `${l.approvalStatus === "REJECTED" ? "Not approved" : "Approved"} by ${l.approvedById ? nameOf.get(l.approvedById) ?? "—" : "—"} on ${day(l.approvedAt) ?? "—"}${l.decisionNote ? `: ${l.decisionNote}` : ""}`}
                    </li>
                    <li><span className="text-muted">Handed over</span> {l.givenDate ? `${day(l.givenDate)}, ${methodLabel(l.method).toLowerCase()}${l.reference ? `, ref ${l.reference}` : ""}` : "Not yet"}</li>
                  </ol>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="py-1">Month</th><th className="py-1 text-right">Planned</th><th className="py-1 text-right">Deducted</th></tr></thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {plan.map((r) => (
                        <tr key={r.month}>
                          <td className="py-1.5">{r.month}</td>
                          <td className="py-1.5 text-right tabular-nums text-secondary">{aed(r.amount)}</td>
                          <td className="py-1.5 text-right tabular-nums">{done.has(r.month) ? <span className="text-[var(--success)]">{aed(done.get(r.month)!)}</span> : <span className="text-subtle">—</span>}</td>
                        </tr>
                      ))}
                      {l.repayments.filter((r) => !plan.some((p) => p.month === r.month)).map((r) => (
                        <tr key={`x-${r.month}`}><td className="py-1.5">{r.month}</td><td className="py-1.5 text-right text-subtle">—</td><td className="py-1.5 text-right tabular-nums text-[var(--success)]">{aed(n(r.amount))}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {state.key === "RECOVERING" && <p className="border-t border-default px-4 py-2 text-xs text-muted">Balance still to deduct: <span className="font-medium text-primary tabular-nums">AED {aed(Math.max(0, principal - n(l.repaid)))}</span></p>}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
