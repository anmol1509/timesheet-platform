import { prisma } from "@/lib/db";
import { computePay, monthBounds, netPay, type PayStructure } from "@/lib/payroll";

const num = (d: { toString(): string } | null | undefined) => (d == null ? 0 : Number(d.toString()));

/**
 * Builds (or rebuilds) the payroll lines for a DRAFT run from the employee pay
 * profiles, that month's attendance, and approved unpaid leave.
 *
 * Who is included: employees of the branch with a pay structure who aren't
 * TERMINATED. Manual adjustments already on the run survive a rebuild (keyed
 * by employee); lines for people who no longer qualify are dropped.
 */
export async function rebuildRunLines(run: { id: string; branchId: string; month: string }) {
  const bounds = monthBounds(run.month);
  if (!bounds) throw new Error("Invalid month");
  const { start, end, days } = bounds;
  const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const [employees, attendance, unpaidLeave, existing] = await Promise.all([
    prisma.employee.findMany({
      where: { branchId: run.branchId, payStructure: { not: null }, status: { not: "TERMINATED" } },
      select: {
        id: true,
        payStructure: true,
        basicSalary: true,
        housingAllowance: true,
        foodAllowance: true,
        transportAllowance: true,
        otherAllowance: true,
        flatMonthlyRate: true,
        hourlyRate: true,
        paysOvertime: true,
        otMultiplier: true,
        molPersonCode: true,
        wpsPaymentMode: true,
        wpsBankName: true,
        wpsRoutingCode: true,
        wpsIban: true,
        wpsAccountNumber: true,
      },
    }),
    prisma.attendance.findMany({
      where: { branchId: run.branchId, date: { gte: start, lt: nextMonth } },
      select: { employeeId: true, status: true, otHours: true, normalHours: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        branchId: run.branchId,
        status: "APPROVED",
        leaveType: { paid: false },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
    prisma.payrollLine.findMany({ where: { runId: run.id }, select: { employeeId: true, adjustment: true, adjustmentNote: true } }),
  ]);

  const att = new Map<string, { absent: number; ot: number; normal: number }>();
  for (const a of attendance) {
    const row = att.get(a.employeeId) ?? { absent: 0, ot: 0, normal: 0 };
    if (a.status === "ABSENT") row.absent += 1;
    row.ot += a.otHours ?? 0;
    row.normal += a.normalHours ?? 0;
    att.set(a.employeeId, row);
  }
  const unpaid = new Map<string, number>();
  for (const l of unpaidLeave) {
    // Clip the request to this month (a request can straddle month ends).
    const s = Math.max(l.startDate.getTime(), start.getTime());
    const e = Math.min(l.endDate.getTime(), end.getTime());
    if (e >= s) unpaid.set(l.employeeId, (unpaid.get(l.employeeId) ?? 0) + Math.round((e - s) / 86_400_000) + 1);
  }
  const prev = new Map(existing.map((x) => [x.employeeId, x]));

  const lines = employees.map((e) => {
    const facts = att.get(e.id) ?? { absent: 0, ot: 0, normal: 0 };
    const unpaidLeaveDays = unpaid.get(e.id) ?? 0;
    const r = computePay(
      {
        payStructure: e.payStructure as PayStructure,
        basic: num(e.basicSalary),
        housing: num(e.housingAllowance),
        food: num(e.foodAllowance),
        transport: num(e.transportAllowance),
        other: num(e.otherAllowance),
        flat: num(e.flatMonthlyRate),
        hourly: num(e.hourlyRate),
        paysOvertime: e.paysOvertime,
        otMultiplier: num(e.otMultiplier) || 1.25,
      },
      { absentDays: facts.absent, unpaidLeaveDays, otHours: facts.ot, normalHours: facts.normal }
    );
    const old = prev.get(e.id);
    const adjustment = num(old?.adjustment);
    return {
      runId: run.id,
      employeeId: e.id,
      payStructure: e.payStructure as string,
      daysInMonth: days,
      absentDays: facts.absent,
      unpaidLeaveDays,
      normalHours: facts.normal,
      otHours: facts.ot,
      basic: r.basic,
      allowances: r.allowances,
      overtimePay: r.overtimePay,
      deductions: r.deductions,
      adjustment,
      adjustmentNote: old?.adjustmentNote ?? null,
      net: netPay(r, adjustment),
      paymentMode: e.wpsPaymentMode,
      personCode: e.molPersonCode,
      bankName: e.wpsBankName,
      routingCode: e.wpsRoutingCode,
      account: e.wpsIban || e.wpsAccountNumber,
    };
  });

  await prisma.$transaction([
    prisma.payrollLine.deleteMany({ where: { runId: run.id } }),
    prisma.payrollLine.createMany({ data: lines }),
  ]);
  return { count: lines.length };
}
