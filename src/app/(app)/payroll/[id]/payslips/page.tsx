import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { PrintButton } from "./print-button";

export const metadata = { title: "Payslips" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (d: { toString(): string }) => Number(d.toString());

export default async function PayslipsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ line?: string }> }) {
  const { id } = await params;
  const { line } = await searchParams;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      branch: true,
      lines: {
        where: line ? { id: line } : {},
        include: { employee: { select: { name: true, employeeIdNo: true, trade: true, position: true } } },
        orderBy: { employee: { name: "asc" } },
      },
    },
  });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">Payslips — {run.month}</h1>
          <p className="mt-1 text-sm text-muted">{run.lines.length} payslip{run.lines.length === 1 ? "" : "s"}. Use Print, then Save as PDF to share.</p>
        </div>
        <PrintButton />
      </div>

      {run.lines.map((l) => {
        const unpaidDays = l.absentDays + l.unpaidLeaveDays;
        return (
          <article key={l.id} className="card mx-auto max-w-2xl space-y-4 p-6 text-sm [break-after:page] print:border-0 print:shadow-none">
            <header className="flex items-start justify-between gap-4 border-b border-default pb-3">
              <div className="flex items-center gap-3">
                {run.branch.logoId && (
                  // eslint-disable-next-line @next/next/no-img-element -- our own image route
                  <img src={`/api/images/${run.branch.logoId}`} alt="" className="h-12 w-12 rounded-md object-contain" />
                )}
                <div>
                  <p className="text-base font-semibold text-primary">{run.branch.name}</p>
                  <p className="text-xs text-muted">{[run.branch.address, run.branch.emirate].filter(Boolean).join(", ")}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-semibold text-primary">Payslip</p>
                <p className="text-xs text-muted">{run.month}</p>
              </div>
            </header>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
              <div className="flex justify-between"><dt className="text-muted">Employee</dt><dd className="text-primary">{l.employee.name}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">ID</dt><dd className="text-primary">{l.employee.employeeIdNo}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Trade</dt><dd className="text-primary">{l.employee.trade ?? l.employee.position ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Paid by</dt><dd className="text-primary">{/cash/i.test(l.paymentMode ?? "") ? "Cash" : l.bankName ?? "Bank transfer"}</dd></div>
            </dl>
            <table className="w-full">
              <tbody className="divide-y divide-[var(--border)]">
                <tr><td className="py-1.5 text-secondary">{l.payStructure === "FLAT" ? "Monthly rate" : l.payStructure === "HOURLY" ? `Hourly pay (${l.normalHours} h)` : "Basic salary"}</td><td className="py-1.5 text-right tabular-nums">{aed(n(l.basic))}</td></tr>
                {n(l.allowances) > 0 && <tr><td className="py-1.5 text-secondary">Allowances</td><td className="py-1.5 text-right tabular-nums">{aed(n(l.allowances))}</td></tr>}
                {n(l.overtimePay) > 0 && <tr><td className="py-1.5 text-secondary">Overtime ({l.otHours} h)</td><td className="py-1.5 text-right tabular-nums">{aed(n(l.overtimePay))}</td></tr>}
                {n(l.deductions) > 0 && <tr><td className="py-1.5 text-secondary">Absence ({unpaidDays} day{unpaidDays === 1 ? "" : "s"})</td><td className="py-1.5 text-right tabular-nums">−{aed(n(l.deductions))}</td></tr>}
                {n(l.otherEarnings) > 0 && <tr><td className="py-1.5 text-secondary">Other earnings</td><td className="py-1.5 text-right tabular-nums">{aed(n(l.otherEarnings))}</td></tr>}
                {n(l.otherDeductions) > 0 && <tr><td className="py-1.5 text-secondary">Other deductions</td><td className="py-1.5 text-right tabular-nums">−{aed(n(l.otherDeductions))}</td></tr>}
                {n(l.manualDeduction) > 0 && <tr><td className="py-1.5 text-secondary">Deduction{l.deductionNote ? ` — ${l.deductionNote}` : ""}</td><td className="py-1.5 text-right tabular-nums">−{aed(n(l.manualDeduction))}</td></tr>}
                {n(l.loanDeduction) > 0 && <tr><td className="py-1.5 text-secondary">Advance recovered{l.advanceNote ? ` — ${l.advanceNote}` : ""}</td><td className="py-1.5 text-right tabular-nums">−{aed(n(l.loanDeduction))}</td></tr>}
                {n(l.adjustment) !== 0 && <tr><td className="py-1.5 text-secondary">{l.adjustmentNote || "Adjustment"}</td><td className="py-1.5 text-right tabular-nums">{n(l.adjustment) > 0 ? "" : "−"}{aed(Math.abs(n(l.adjustment)))}</td></tr>}
                <tr className="font-semibold"><td className="py-2 text-primary">Net pay (AED)</td><td className="py-2 text-right tabular-nums text-primary">{aed(n(l.net))}</td></tr>
              </tbody>
            </table>
            <p className="text-xs text-muted">Computer-generated payslip.</p>
          </article>
        );
      })}
    </div>
  );
}
