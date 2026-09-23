import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEssEmployee } from "@/lib/ess/session";
import { PrintButton } from "./print-button";

export const metadata = { title: "Payslip" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (d: { toString(): string }) => Number(d.toString());

export default async function EssPayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = (await getEssEmployee())!;
  // Scoped to the signed-in employee AND to runs that have been approved.
  const l = await prisma.payrollLine.findFirst({
    where: { id, employeeId: employee.id, run: { status: { in: ["APPROVED", "PAID"] } } },
    include: { run: { select: { month: true, branch: { select: { name: true } } } } },
  });
  if (!l) notFound();
  const unpaidDays = l.absentDays + l.unpaidLeaveDays;

  return (
    <>
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/me/payslips" className="text-sm text-muted hover:text-secondary">← Payslips</Link>
        <PrintButton />
      </div>
      <article className="card space-y-4 p-5 text-sm">
        <header className="flex items-start justify-between gap-4 border-b border-default pb-3">
          <div>
            <p className="text-base font-semibold text-primary">{l.run.branch.name}</p>
            <p className="text-xs text-muted">{employee.name} · {employee.employeeIdNo}</p>
          </div>
          <div className="text-right">
            <p className="text-base font-semibold text-primary">Payslip</p>
            <p className="text-xs text-muted">{l.run.month}</p>
          </div>
        </header>
        <table className="w-full">
          <tbody className="divide-y divide-[var(--border)]">
            <tr><td className="py-1.5 text-secondary">{l.payStructure === "FLAT" ? "Monthly rate" : l.payStructure === "HOURLY" ? `Hourly pay (${l.normalHours} h)` : "Basic salary"}</td><td className="py-1.5 text-right tabular-nums">{aed(n(l.basic))}</td></tr>
            {n(l.allowances) > 0 && <tr><td className="py-1.5 text-secondary">Allowances</td><td className="py-1.5 text-right tabular-nums">{aed(n(l.allowances))}</td></tr>}
            {n(l.overtimePay) > 0 && <tr><td className="py-1.5 text-secondary">Overtime ({l.otHours} h)</td><td className="py-1.5 text-right tabular-nums">{aed(n(l.overtimePay))}</td></tr>}
            {n(l.deductions) > 0 && <tr><td className="py-1.5 text-secondary">Absence / unpaid leave ({unpaidDays} day{unpaidDays === 1 ? "" : "s"})</td><td className="py-1.5 text-right tabular-nums">−{aed(n(l.deductions))}</td></tr>}
            {n(l.adjustment) !== 0 && <tr><td className="py-1.5 text-secondary">{l.adjustmentNote || "Adjustment"}</td><td className="py-1.5 text-right tabular-nums">{n(l.adjustment) > 0 ? "" : "−"}{aed(Math.abs(n(l.adjustment)))}</td></tr>}
            <tr className="font-semibold"><td className="py-2 text-primary">Net pay (AED)</td><td className="py-2 text-right tabular-nums text-primary">{aed(n(l.net))}</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-muted">Computer-generated payslip.</p>
      </article>
    </>
  );
}
