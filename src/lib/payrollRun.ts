import { prisma } from "@/lib/db";
import { appliesToMonth, computePay, monthBounds, netPayWithExtras, planLoanRecovery, round2, type PayStructure } from "@/lib/payroll";

const num = (d: { toString(): string } | null | undefined) => (d == null ? 0 : Number(d.toString()));

/**
 * Builds (or rebuilds) the payroll lines for a DRAFT run from the employee pay
 * profiles and that month's attendance (days marked Absent, overtime hours).
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

  const [employees, attendance, existing, standing, loans] = await Promise.all([
    prisma.employee.findMany({
      where: { branchId: run.branchId, payStructure: { not: null }, status: { not: "TERMINATED" } },
      select: {
        id: true,
        projectId: true,
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
    prisma.payrollLine.findMany({ where: { runId: run.id }, select: { employeeId: true, adjustment: true, adjustmentNote: true } }),
    prisma.payrollAdjustment.findMany({
      where: { branchId: run.branchId, active: true, startMonth: { lte: run.month } },
      select: { employeeId: true, kind: true, amount: true, startMonth: true, endMonth: true },
    }),
    prisma.employeeLoan.findMany({
      where: { branchId: run.branchId, status: "ACTIVE", startMonth: { lte: run.month } },
      select: { id: true, employeeId: true, principal: true, repaid: true, instalment: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const extras = new Map<string, { earn: number; deduct: number }>();
  for (const a of standing) {
    if (!appliesToMonth(a, run.month)) continue;
    const row = extras.get(a.employeeId) ?? { earn: 0, deduct: 0 };
    if (a.kind === "EARNING") row.earn = round2(row.earn + num(a.amount));
    else row.deduct = round2(row.deduct + num(a.amount));
    extras.set(a.employeeId, row);
  }
  const loansByEmployee = new Map<string, { id: string; remaining: number; instalment: number }[]>();
  for (const l of loans) {
    const remaining = round2(num(l.principal) - num(l.repaid));
    if (remaining <= 0) continue;
    const list = loansByEmployee.get(l.employeeId) ?? [];
    list.push({ id: l.id, remaining, instalment: num(l.instalment) });
    loansByEmployee.set(l.employeeId, list);
  }

  const att = new Map<string, { absent: number; ot: number; normal: number }>();
  for (const a of attendance) {
    const row = att.get(a.employeeId) ?? { absent: 0, ot: 0, normal: 0 };
    if (a.status === "ABSENT") row.absent += 1;
    row.ot += a.otHours ?? 0;
    row.normal += a.normalHours ?? 0;
    att.set(a.employeeId, row);
  }
  const prev = new Map(existing.map((x) => [x.employeeId, x]));

  const lines = employees.map((e) => {
    const facts = att.get(e.id) ?? { absent: 0, ot: 0, normal: 0 };
    const unpaidLeaveDays = 0;
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
    const ex = extras.get(e.id) ?? { earn: 0, deduct: 0 };
    // Loan recovery only takes what is left after everything else, so it can
    // never push net pay below zero.
    const beforeLoans = netPayWithExtras(r, adjustment, { otherEarnings: ex.earn, otherDeductions: ex.deduct, loanDeduction: 0 });
    const recovery = planLoanRecovery(loansByEmployee.get(e.id) ?? [], beforeLoans);
    const loanDeduction = round2(recovery.reduce((sum, x) => sum + x.amount, 0));
    return {
      runId: run.id,
      employeeId: e.id,
      projectId: e.projectId,
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
      otherEarnings: ex.earn,
      otherDeductions: ex.deduct,
      loanDeduction,
      net: netPayWithExtras(r, adjustment, { otherEarnings: ex.earn, otherDeductions: ex.deduct, loanDeduction }),
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

/**
 * Writes the loan repayments a run's lines imply and bumps each loan's repaid
 * total, clearing loans that reach zero. Called on approval; idempotent per
 * (loan, line) so a retry cannot double-count.
 */
export async function recordLoanRepayments(run: { id: string; branchId: string; month: string }) {
  const lines = await prisma.payrollLine.findMany({ where: { runId: run.id, loanDeduction: { gt: 0 } }, select: { id: true, employeeId: true, loanDeduction: true } });
  if (lines.length === 0) return;
  const loans = await prisma.employeeLoan.findMany({
    where: { branchId: run.branchId, status: "ACTIVE", employeeId: { in: lines.map((l) => l.employeeId) } },
    orderBy: { createdAt: "asc" },
  });
  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const mine = loans
        .filter((l) => l.employeeId === line.employeeId)
        .map((l) => ({ id: l.id, remaining: round2(num(l.principal) - num(l.repaid)), instalment: num(l.instalment) }));
      for (const { loanId, amount } of planLoanRecovery(mine, num(line.loanDeduction))) {
        const made = await tx.loanRepayment.createMany({ data: [{ loanId, lineId: line.id, amount, month: run.month }], skipDuplicates: true });
        if (made.count === 0) continue;
        const loan = await tx.employeeLoan.update({ where: { id: loanId }, data: { repaid: { increment: amount } } });
        if (num(loan.repaid) >= num(loan.principal)) await tx.employeeLoan.update({ where: { id: loanId }, data: { status: "CLEARED" } });
      }
    }
  });
}

/** Undoes recordLoanRepayments when an approved run is reopened. */
export async function reverseLoanRepayments(runId: string) {
  const repayments = await prisma.loanRepayment.findMany({ where: { line: { runId } }, select: { id: true, loanId: true, amount: true } });
  if (repayments.length === 0) return;
  await prisma.$transaction(async (tx) => {
    for (const r of repayments) {
      await tx.employeeLoan.update({ where: { id: r.loanId }, data: { repaid: { decrement: num(r.amount) } } });
      await tx.employeeLoan.updateMany({ where: { id: r.loanId, status: "CLEARED" }, data: { status: "ACTIVE" } });
    }
    await tx.loanRepayment.deleteMany({ where: { id: { in: repayments.map((r) => r.id) } } });
  });
}

export type ReadinessIssue = { level: "block" | "warn"; text: string; href?: string };

/**
 * What to sort out before approving a run, in plain words. Blocking issues are
 * the ones approval itself refuses on (bank details); the rest are things that
 * usually mean a wrong number rather than a rejected file.
 */
export async function runReadiness(run: { id: string; branchId: string; month: string }): Promise<ReadinessIssue[]> {
  const bounds = monthBounds(run.month);
  if (!bounds) return [];
  const nextMonth = new Date(Date.UTC(bounds.start.getUTCFullYear(), bounds.start.getUTCMonth() + 1, 1));
  const [lines, attendedRows, noStructure, prevRun] = await Promise.all([
    prisma.payrollLine.findMany({ where: { runId: run.id }, select: { employeeId: true, net: true, payStructure: true, employee: { select: { name: true } } } }),
    prisma.attendance.findMany({ where: { branchId: run.branchId, date: { gte: bounds.start, lt: nextMonth } }, distinct: ["employeeId"], select: { employeeId: true } }),
    prisma.employee.count({ where: { branchId: run.branchId, status: { not: "TERMINATED" }, payStructure: null } }),
    prisma.payrollRun.findFirst({ where: { branchId: run.branchId, month: { lt: run.month } }, orderBy: { month: "desc" }, include: { lines: { select: { net: true } } } }),
  ]);
  const issues: ReadinessIssue[] = [];
  const attended = new Set(attendedRows.map((a) => a.employeeId));
  const monthly = lines.filter((l) => l.payStructure !== "HOURLY");
  const noAttendance = monthly.filter((l) => !attended.has(l.employeeId));
  if (noAttendance.length > 0 && attended.size > 0) {
    issues.push({ level: "warn", text: `${noAttendance.length} employee${noAttendance.length === 1 ? " has" : "s have"} no attendance recorded for ${run.month}, so absences and overtime are counted as zero: ${noAttendance.slice(0, 3).map((l) => l.employee.name).join(", ")}${noAttendance.length > 3 ? "…" : ""}.`, href: "/attendance" });
  }
  if (attended.size === 0 && lines.length > 0) {
    issues.push({ level: "warn", text: `No attendance has been recorded for ${run.month}. Everyone is paid in full with no overtime.`, href: "/attendance" });
  }
  const zero = lines.filter((l) => num(l.net) <= 0);
  if (zero.length > 0) issues.push({ level: "warn", text: `${zero.length} employee${zero.length === 1 ? " has" : "s have"} zero net pay: ${zero.slice(0, 3).map((l) => l.employee.name).join(", ")}${zero.length > 3 ? "…" : ""}.` });
  if (noStructure > 0) issues.push({ level: "warn", text: `${noStructure} active employee${noStructure === 1 ? " has" : "s have"} no pay structure and ${noStructure === 1 ? "is" : "are"} not in this run.`, href: "/employees" });
  if (prevRun && prevRun.lines.length > 0) {
    const prevTotal = prevRun.lines.reduce((s, l) => s + num(l.net), 0);
    const total = lines.reduce((s, l) => s + num(l.net), 0);
    if (prevTotal > 0) {
      const pct = Math.round(((total - prevTotal) / prevTotal) * 100);
      if (Math.abs(pct) >= 15) issues.push({ level: "warn", text: `Total net pay is ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% on ${prevRun.month}. Worth a look before approving.` });
    }
  }
  return issues;
}
