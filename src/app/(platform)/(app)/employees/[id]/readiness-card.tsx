import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { StatusItem } from "@/components/StatusRow";
import { prisma } from "@/lib/db";
import { payrollReadiness } from "@/lib/payrollReadiness";

const num = (d: { toString(): string } | null) => (d ? Number(d.toString()) : 0);

/**
 * Whether this worker can be paid in a run, and exactly what to fix if not, as a chip for the profile's status row.
 * Shown only to people who can see pay. `ok` is true when everything is in order.
 */
export async function readinessItem(employeeId: string): Promise<{ item: StatusItem | null; ok: boolean }> {
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
  if (!e) return { item: null, ok: false };
  const r = payrollReadiness({
    company: e.supplier?.isOwnCompany && e.sponsorSupplier?.isOwnCompany ? e.sponsorSupplier : e.supplier, payStructure: e.payStructure, basicSalary: num(e.basicSalary), flatMonthlyRate: num(e.flatMonthlyRate), hourlyRate: num(e.hourlyRate),
    paymentMode: e.wpsPaymentMode, molPersonCode: e.molPersonCode, routingCode: e.wpsRoutingCode, account: e.wpsIban || e.wpsAccountNumber,
    laborCardExpiry: e.laborCardExpiry, emiratesIdExpiry: e.emiratesIdExpiry, visaExpiry: e.visaExpiry,
  });
  if (!r.applies) return { item: null, ok: false };
  const problems = r.items.filter((i) => !i.ok);
  if (problems.length === 0) return { item: null, ok: true };
  return {
    ok: false,
    item: {
      key: "payroll", tone: r.ready ? "warn" : "danger",
      label: r.ready ? `Payroll: ${problems.length} warning${problems.length === 1 ? "" : "s"}` : `Not ready for payroll (${problems.length})`,
      title: r.ready ? "Ready for payroll, with warnings" : "Not ready for payroll yet",
      content: (
        <ul className="space-y-2 text-sm">
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
      ),
    },
  };
}
