import { prisma } from "@/lib/db";
import { appliesToMonth, capToAvailable, computePay, isPayType, monthBounds, netPayWithExtras, payDataGap, planLoanRecovery, round2, splitDayHours, gasChargeFor, effectivePay, type PayStructure } from "@/lib/payroll";

const num = (d: { toString(): string } | null | undefined) => (d == null ? 0 : Number(d.toString()));

export type RunScope = { id: string; branchId: string; month: string; companyId: string | null; payType: string | null };
const n2 = (d: unknown) => num(d as { toString(): string } | null);

type PayEmployee = {
  supplierId: string | null; trade: string | null; position: string | null; payOverride: boolean; payStructure: string | null; basicSalary: unknown; housingAllowance: unknown;
  foodAllowance: unknown; transportAllowance: unknown; otherAllowance: unknown; flatMonthlyRate: unknown; hourlyRate: unknown; dailyHours: unknown; paysOvertime: boolean;
  otMultiplier: unknown; restOtMultiplier: unknown;
};

/** The pay figures to use for a worker: what is on their own record. */
export async function loadPayOf(_branchId: string, _employees: PayEmployee[]) {
  return (e: PayEmployee) =>
    effectivePay(
      {
        payStructure: e.payStructure, basicSalary: n2(e.basicSalary), housingAllowance: n2(e.housingAllowance), foodAllowance: n2(e.foodAllowance), transportAllowance: n2(e.transportAllowance),
        otherAllowance: n2(e.otherAllowance), flatMonthlyRate: n2(e.flatMonthlyRate), hourlyRate: n2(e.hourlyRate), dailyHours: n2(e.dailyHours) || 8, paysOvertime: e.paysOvertime,
        otMultiplier: n2(e.otMultiplier) || 1.25, restOtMultiplier: n2(e.restOtMultiplier) || 1.5, payOverride: true,
      },
      null
    );
}

export type SkippedEmployee = { id: string; name: string; reason: string };

/**
 * Builds (or rebuilds) the payroll lines for a DRAFT run.
 *
 * Who is paid: employees of the run's own company (or, for a run that predates
 * companies, of any own company) who aren't TERMINATED. Third-party supplier
 * labour is never in payroll.
 *
 * How: the company's pay type decides.
 *  - BASIC: the monthly figure on the employee record, with absences and
 *    overtime from attendance.
 *  - HOURLY: hours from that month's timesheet times the employee's hourly rate.
 *    A timesheet carries one combined figure per day, so every hour is paid at
 *    the hourly rate; attendance is not consulted.
 * Employees who lack what the type needs are skipped and returned, so the run
 * can say who and why instead of silently paying them nothing.
 *
 * Things typed on the run (adjustment, deduction, advance, and their notes)
 * survive a rebuild, keyed by employee.
 */
export async function rebuildRunLines(run: RunScope): Promise<{ count: number; skipped: SkippedEmployee[] }> {
  const bounds = monthBounds(run.month);
  if (!bounds) throw new Error("Invalid month");
  const { start, days } = bounds;
  const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const type = isPayType(run.payType) ? run.payType : null;

  const [employees, existing, standing, loans] = await Promise.all([
    prisma.employee.findMany({
      where: {
        branchId: run.branchId,
        status: { not: "TERMINATED" },
        supplier: { isOwnCompany: true, ...(run.companyId ? { id: run.companyId } : {}) },
      },
      select: {
        id: true, name: true, employeeIdNo: true, projectId: true, supplierId: true, trade: true, position: true, payOverride: true, project: { select: { weeklyOffDays: true } }, supplier: { select: { absentFreeDays: true, absentDeductionPerDay: true, gasPerDay: true, gasMonthlyCap: true } }, gasWaived: true, siteArrivalDate: true, payStructure: true, basicSalary: true, housingAllowance: true, foodAllowance: true, transportAllowance: true,
        otherAllowance: true, flatMonthlyRate: true, hourlyRate: true, paysOvertime: true, otMultiplier: true, dailyHours: true, restOtMultiplier: true, molPersonCode: true, wpsPaymentMode: true, wpsBankName: true,
        wpsRoutingCode: true, wpsIban: true, wpsAccountNumber: true,
      },
    }),
    prisma.payrollLine.findMany({
      where: { runId: run.id },
      select: { employeeId: true, adjustment: true, adjustmentNote: true, manualDeduction: true, deductionNote: true, advanceNote: true, advanceManual: true, loanDeduction: true },
    }),
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

  const payOf = await loadPayOf(run.branchId, employees);

  // Who can actually be paid under this run's type.
  const skipped: SkippedEmployee[] = [];
  const payable = employees.filter((e) => {
    const pf = payOf(e);
    const gap = payDataGap(type, { payStructure: pf.payStructure, basicSalary: pf.basicSalary, flatMonthlyRate: pf.flatMonthlyRate, hourlyRate: pf.hourlyRate });
    if (gap) skipped.push({ id: e.id, name: e.name, reason: gap });
    return !gap;
  });
  const ids = payable.map((e) => e.id);

  // Attendance for basic (and legacy) runs; timesheet hours for hourly runs.
  const attendance = ids.length === 0 ? [] : await prisma.attendance.findMany({
    where: { branchId: run.branchId, employeeId: { in: ids }, date: { gte: start, lt: nextMonth } },
    select: { employeeId: true, date: true, status: true, otHours: true, normalHours: true },
  });
  const sheetRows = type === "HOURLY" && ids.length > 0
    ? await prisma.timesheetEntry.groupBy({
        by: ["employeeIdNo"],
        where: { month: run.month, employeeIdNo: { in: payable.map((e) => e.employeeIdNo) }, status: { not: "REJECTED" } },
        _sum: { totalHours: true },
      })
    : [];
  const sheetHours = new Map(sheetRows.map((r) => [r.employeeIdNo, r._sum.totalHours ?? 0]));

  const patterns = new Map(payable.map((e) => [e.id, { dailyHours: payOf(e).dailyHours, weeklyOffDays: e.project?.weeklyOffDays ?? [5] }]));
  const att = new Map<string, { absent: number; idle: number; sick: number; ot: number; normal: number; rest: number }>();
  for (const a of attendance) {
    const row = att.get(a.employeeId) ?? { absent: 0, idle: 0, sick: 0, ot: 0, normal: 0, rest: 0 };
    if (a.status === "ABSENT") row.absent += 1;
    else if (a.status === "IDLE") row.idle += 1;
    else if (a.status === "SICK_LEAVE") row.sick += 1;
    const split = splitDayHours(a, patterns.get(a.employeeId) ?? { dailyHours: 8, weeklyOffDays: [5] });
    row.ot += split.ot;
    row.normal += split.normal;
    row.rest += split.rest;
    att.set(a.employeeId, row);
  }

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
  const prev = new Map(existing.map((x) => [x.employeeId, x]));

  const lines = payable.map((e) => {
    const isHourly = type === "HOURLY";
    const hours = isHourly ? sheetHours.get(e.employeeIdNo) ?? 0 : 0;
    const facts = att.get(e.id) ?? { absent: 0, idle: 0, sick: 0, ot: 0, normal: 0, rest: 0 };
    const pf = payOf(e);
    const r = computePay(
      {
        payStructure: (isHourly ? "HOURLY" : pf.payStructure) as PayStructure,
        basic: pf.basicSalary, housing: pf.housingAllowance, food: pf.foodAllowance, transport: pf.transportAllowance, other: pf.otherAllowance,
        flat: pf.flatMonthlyRate, hourly: pf.hourlyRate, paysOvertime: isHourly ? false : pf.paysOvertime, otMultiplier: pf.otMultiplier,
        dailyHours: pf.dailyHours, restOtMultiplier: pf.restOtMultiplier,
        absenceFreeDays: e.supplier?.absentFreeDays ?? 2, absencePerDay: e.supplier ? num(e.supplier.absentDeductionPerDay) : 30,
      },
      isHourly
        ? { absentDays: facts.absent, unpaidLeaveDays: 0, otHours: 0, normalHours: hours }
        : { absentDays: facts.absent, unpaidLeaveDays: 0, otHours: facts.ot, restHours: facts.rest, normalHours: facts.normal }
    );
    const old = prev.get(e.id);
    const adjustment = num(old?.adjustment);
    const ex = extras.get(e.id) ?? { earn: 0, deduct: 0 };
    // Gas never takes pay below zero: it can only take what is left after deductions.
    const gasCharge = Math.min(
      gasChargeFor({ checkIn: e.siteArrivalDate, monthStart: start, daysInMonth: days, perDay: e.supplier ? num(e.supplier.gasPerDay) : 1, cap: e.supplier ? num(e.supplier.gasMonthlyCap) : 30, waived: e.gasWaived }),
      Math.max(0, round2(r.fixed - r.deductions + r.overtimePay))
    );
    const recurring = { otherEarnings: ex.earn, otherDeductions: ex.deduct, loanDeduction: 0, manualDeduction: 0, gasCharge };

    // Typed entries can never push net pay below zero: the deduction takes what it
    // can first, then the advance takes what is left of that.
    const beforeManual = netPayWithExtras(r, adjustment, recurring);
    const manualDeduction = capToAvailable(num(old?.manualDeduction), beforeManual);
    const beforeAdvance = round2(beforeManual - manualDeduction);
    const advanceManual = !!old?.advanceManual;
    const loanDeduction = advanceManual
      ? capToAvailable(num(old?.loanDeduction), beforeAdvance)
      : round2(planLoanRecovery(loansByEmployee.get(e.id) ?? [], beforeAdvance).reduce((sum, x) => sum + x.amount, 0));

    return {
      runId: run.id, employeeId: e.id, projectId: e.projectId, payStructure: (isHourly ? "HOURLY" : pf.payStructure) as string, daysInMonth: days,
      absentDays: facts.absent, idleDays: facts.idle, sickDays: facts.sick, gasCharge, unpaidLeaveDays: 0, normalHours: isHourly ? hours : facts.normal, otHours: isHourly ? 0 : facts.ot, restHours: isHourly ? 0 : facts.rest, timesheetHours: hours,
      basic: r.basic, allowances: r.allowances, overtimePay: r.overtimePay, deductions: r.deductions,
      adjustment, adjustmentNote: old?.adjustmentNote ?? null,
      manualDeduction, deductionNote: old?.deductionNote ?? null,
      advanceNote: old?.advanceNote ?? null, advanceManual,
      otherEarnings: ex.earn, otherDeductions: ex.deduct, loanDeduction,
      net: netPayWithExtras(r, adjustment, { ...recurring, loanDeduction, manualDeduction }),
      paymentMode: e.wpsPaymentMode, personCode: e.molPersonCode, bankName: e.wpsBankName, routingCode: e.wpsRoutingCode, account: e.wpsIban || e.wpsAccountNumber,
    };
  });

  await prisma.$transaction([
    prisma.payrollLine.deleteMany({ where: { runId: run.id } }),
    prisma.payrollLine.createMany({ data: lines }),
  ]);
  return { count: lines.length, skipped };
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

/** Own-company employees who are not in the run because they lack what its pay type needs. */
export async function runSkipped(run: RunScope): Promise<SkippedEmployee[]> {
  const type = isPayType(run.payType) ? run.payType : null;
  const employees = await prisma.employee.findMany({
    where: { branchId: run.branchId, status: { not: "TERMINATED" }, supplier: { isOwnCompany: true, ...(run.companyId ? { id: run.companyId } : {}) } },
    select: {
      id: true, name: true, supplierId: true, trade: true, position: true, payOverride: true, payStructure: true, basicSalary: true, housingAllowance: true, foodAllowance: true,
      transportAllowance: true, otherAllowance: true, flatMonthlyRate: true, hourlyRate: true, dailyHours: true, paysOvertime: true, otMultiplier: true, restOtMultiplier: true,
    },
  });
  const payOf = await loadPayOf(run.branchId, employees);
  return employees.flatMap((e) => {
    const pf = payOf(e);
    const reason = payDataGap(type, { payStructure: pf.payStructure, basicSalary: pf.basicSalary, flatMonthlyRate: pf.flatMonthlyRate, hourlyRate: pf.hourlyRate });
    return reason ? [{ id: e.id, name: e.name, reason }] : [];
  });
}

export type ReadinessIssue = { level: "block" | "warn"; text: string; href?: string };

/**
 * What to sort out before approving a run, in plain words. Blocking issues are
 * the ones approval itself refuses on (bank details); the rest are things that
 * usually mean a wrong number rather than a rejected file.
 */
export async function runReadiness(run: RunScope): Promise<ReadinessIssue[]> {
  const bounds = monthBounds(run.month);
  if (!bounds) return [];
  const nextMonth = new Date(Date.UTC(bounds.start.getUTCFullYear(), bounds.start.getUTCMonth() + 1, 1));
  const hourly = run.payType === "HOURLY";
  const [lines, skipped, prevRun] = await Promise.all([
    prisma.payrollLine.findMany({ where: { runId: run.id }, select: { employeeId: true, net: true, payStructure: true, timesheetHours: true, employee: { select: { name: true, employeeIdNo: true } } } }),
    runSkipped(run),
    prisma.payrollRun.findFirst({ where: { branchId: run.branchId, companyId: run.companyId, month: { lt: run.month } }, orderBy: { month: "desc" }, include: { lines: { select: { net: true } } } }),
  ]);
  const issues: ReadinessIssue[] = [];
  const names = (xs: { name: string }[]) => `${xs.slice(0, 3).map((x) => x.name).join(", ")}${xs.length > 3 ? "…" : ""}`;

  if (skipped.length > 0) {
    issues.push({ level: "warn", text: `${skipped.length} employee${skipped.length === 1 ? " is" : "s are"} not in this run because their pay details are missing: ${skipped.slice(0, 3).map((x) => `${x.name} (${x.reason})`).join("; ")}${skipped.length > 3 ? "…" : ""}.`, href: "/employees" });
  }

  if (hourly) {
    // Hours come from the timesheet: flag sheets that haven't been approved, and people with no hours at all.
    const ids = lines.map((l) => l.employee.employeeIdNo);
    const pending = ids.length ? await prisma.timesheetEntry.count({ where: { month: run.month, employeeIdNo: { in: ids }, status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"] } } }) : 0;
    if (pending > 0) issues.push({ level: "warn", text: `${pending} timesheet row${pending === 1 ? " is" : "s are"} for ${run.month} still not approved, so the hours may change. Recalculate after they are final.`, href: "/invoices/client-timesheet" });
    const noHours = lines.filter((l) => l.timesheetHours <= 0);
    if (noHours.length > 0) issues.push({ level: "warn", text: `${noHours.length} employee${noHours.length === 1 ? " has" : "s have"} no timesheet hours for ${run.month}, so ${noHours.length === 1 ? "they are" : "they are all"} paid nothing: ${names(noHours.map((l) => l.employee))}.`, href: "/invoices/client-timesheet" });
  } else {
    const attendedRows = await prisma.attendance.findMany({ where: { branchId: run.branchId, date: { gte: bounds.start, lt: nextMonth } }, distinct: ["employeeId"], select: { employeeId: true } });
    const attended = new Set(attendedRows.map((a) => a.employeeId));
    const noAttendance = lines.filter((l) => l.payStructure !== "HOURLY" && !attended.has(l.employeeId));
    if (noAttendance.length > 0 && attended.size > 0) issues.push({ level: "warn", text: `${noAttendance.length} employee${noAttendance.length === 1 ? " has" : "s have"} no attendance recorded for ${run.month}, so absences and overtime are counted as zero: ${names(noAttendance.map((l) => l.employee))}.`, href: "/attendance" });
    if (attended.size === 0 && lines.length > 0) issues.push({ level: "warn", text: `No attendance has been recorded for ${run.month}. Everyone is paid in full with no overtime.`, href: "/attendance" });
  }

  const zero = lines.filter((l) => num(l.net) <= 0);
  if (zero.length > 0) issues.push({ level: "warn", text: `${zero.length} employee${zero.length === 1 ? " has" : "s have"} zero net pay: ${names(zero.map((l) => l.employee))}.` });
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
