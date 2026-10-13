import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { prisma } from "@/lib/db";
import { payrollReadiness } from "@/lib/payrollReadiness";

const num = (d: { toString(): string } | null) => (d ? Number(d.toString()) : 0);

/** Whether this worker can be paid in a run, and exactly what to fix if not. Shown only to people who can see pay. */
export async function ReadinessCard({ employeeId }: { employeeId: string }) {
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      payStructure: true, basicSalary: true, flatMonthlyRate: true, hourlyRate: true,
      wpsPaymentMode: true, molPersonCode: true, wpsRoutingCode: true, wpsIban: true, wpsAccountNumber: true,
      laborCardExpiry: true, emiratesIdExpiry: true, visaExpiry: true,
      supplier: { select: { name: true, isOwnCompany: true, payType: true } },
      sponsorSupplier: { select: { name: true, isOwnCompany: true, payType: true } },
    },
  });
  if (!e) return null;
  const r = payrollReadiness({
    company: e.supplier?.isOwnCompany && e.sponsorSupplier?.isOwnCompany ? e.sponsorSupplier : e.supplier, payStructure: e.payStructure, basicSalary: num(e.basicSalary), flatMonthlyRate: num(e.flatMonthlyRate), hourlyRate: num(e.hourlyRate),
    paymentMode: e.wpsPaymentMode, molPersonCode: e.molPersonCode, routingCode: e.wpsRoutingCode, account: e.wpsIban || e.wpsAccountNumber,
    laborCardExpiry: e.laborCardExpiry, emiratesIdExpiry: e.emiratesIdExpiry, visaExpiry: e.visaExpiry,
  });
  if (!r.applies) return r.note ? <p className="flex items-start gap-2 rounded-md border border-default px-4 py-3 text-sm text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{r.note}</p> : null;
  const problems = r.items.filter((i) => !i.ok);
  if (problems.length === 0) return <p className="flex items-center gap-2 rounded-md border border-default px-4 py-2.5 text-sm text-[var(--success)]"><CheckCircle2 className="h-4 w-4" aria-hidden />Ready for payroll: pay, bank details and documents are all in order.</p>;
  return (
    <section className="card p-4" aria-label="Payroll readiness">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
        <AlertTriangle className={`h-4 w-4 ${r.ready ? "text-[var(--warning)]" : "text-[var(--error)]"}`} aria-hidden />
        {r.ready ? "Ready for payroll, with warnings" : "Not ready for payroll yet"}
      </h2>
      <ul className="mt-2 space-y-1.5 text-sm">
        {r.items.map((i) => (
          <li key={i.key} className="flex items-start gap-2">
            {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden /> : <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${i.blocking ? "text-[var(--error)]" : "text-[var(--warning)]"}`} aria-hidden />}
            <span className={i.ok ? "text-muted" : "text-primary"}>
              <span className="font-medium">{i.label}</span>
              {!i.ok && <> — {i.problem}. <span className="text-muted">Fix on the {i.fix}.</span></>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
