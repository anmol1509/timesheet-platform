import type { StatusItem } from "@/components/StatusRow";
import { prisma } from "@/lib/db";
import { payrollReadiness } from "@/lib/payrollReadiness";
import { structuresFor } from "@/lib/payFields";
import { ReadinessFixes } from "./profile-fixes";

const num = (d: { toString(): string } | null) => (d ? Number(d.toString()) : 0);
const txt = (d: { toString(): string } | null) => (d == null ? "" : String(Number(d.toString())));

/**
 * Whether this worker can be paid in a run, and exactly what to fix if not, as a chip for the profile's status row.
 * Shown only to people who can see pay. `ok` is true when everything is in order.
 */
export async function readinessItem(employeeId: string): Promise<{ item: StatusItem | null; ok: boolean }> {
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      payStructure: true, basicSalary: true, flatMonthlyRate: true, hourlyRate: true, housingAllowance: true, foodAllowance: true, transportAllowance: true, otherAllowance: true,
      wpsPaymentMode: true, wpsBankName: true, molPersonCode: true, wpsRoutingCode: true, wpsIban: true, wpsAccountNumber: true,
      laborCardExpiry: true, emiratesIdExpiry: true, visaExpiry: true,
      supplier: { select: { name: true, isOwnCompany: true, payType: true } },
      sponsorSupplier: { select: { name: true, isOwnCompany: true, payType: true } },
    },
  });
  if (!e) return { item: null, ok: false };
  const company = e.supplier?.isOwnCompany && e.sponsorSupplier?.isOwnCompany ? e.sponsorSupplier : e.supplier;
  const r = payrollReadiness({
    company, payStructure: e.payStructure, basicSalary: num(e.basicSalary), flatMonthlyRate: num(e.flatMonthlyRate), hourlyRate: num(e.hourlyRate),
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
        <ReadinessFixes
          employeeId={employeeId}
          rows={r.items.map((i) => ({ key: i.key, label: i.label, ok: i.ok, problem: i.problem, blocking: !!i.blocking }))}
          pay={{ structures: structuresFor(company?.payType ?? null), structure: e.payStructure ?? "", rate: e.payStructure === "ITEMISED" ? txt(e.basicSalary) : e.payStructure === "HOURLY" ? txt(e.hourlyRate) : txt(e.flatMonthlyRate), housing: txt(e.housingAllowance), food: txt(e.foodAllowance), transport: txt(e.transportAllowance), other: txt(e.otherAllowance) }}
          bank={{ personCode: e.molPersonCode ?? "", routingCode: e.wpsRoutingCode ?? "", iban: e.wpsIban ?? "", bankName: e.wpsBankName ?? "" }}
          expiries={{}}
        />
      ),
    },
  };
}
