import { advanceRef } from "@/lib/advances";
import type { ApplyCtx, ApplyResult, ImportNote, MappedRow, RowReport } from "../types";
import { auditor, clean, parseLooseDate } from "./shared";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "2026-03", "03/2026", "Mar 2026" or any full date, as "YYYY-MM". Null when it is none of those. */
export function monthOf(raw: string): string | null {
  const s = clean(raw);
  let m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) return +m[2] >= 1 && +m[2] <= 12 ? `${m[1]}-${m[2].padStart(2, "0")}` : null;
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return +m[1] >= 1 && +m[1] <= 12 ? `${m[2]}-${m[1].padStart(2, "0")}` : null;
  m = s.match(/^([A-Za-z]{3,})[-/. ,]*(\d{2,4})$/);
  if (m) {
    const i = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    const y = +m[2] < 100 ? 2000 + +m[2] : +m[2];
    return i < 0 ? null : `${y}-${String(i + 1).padStart(2, "0")}`;
  }
  const d = parseLooseDate(s);
  return d instanceof Date ? d.toISOString().slice(0, 7) : null;
}

/** "AED 1,200.50" → 1200.5; null when it is not a number. */
export function amountOf(raw: string): number | null {
  const t = clean(raw).replace(/aed|,|\s/gi, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Opening balances: loans and advances already running before the system. They go in approved and handed over, with what is
 * already repaid recorded, so payroll recovers only the balance. Workers are found by employee code, never guessed. A loan
 * already on file (same person, type, amount and start month) is skipped, so loading a file twice cannot double a deduction. */
export async function applyLoans(ctx: ApplyCtx, input: MappedRow[]): Promise<ApplyResult> {
  const { db, branchId } = ctx;
  const audit = auditor(ctx);
  const rows: RowReport[] = [];
  const counts = { created: 0, cleared: 0, skipped: 0, failed: 0 };
  const thisMonth = new Date().toISOString().slice(0, 7);

  const roster = await db.employee.findMany({ where: { branchId }, select: { id: true, name: true, employeeIdNo: true } });
  const byCode = new Map(roster.map((p) => [p.employeeIdNo.toLowerCase(), p]));
  const existing = await db.employeeLoan.findMany({ where: { branchId, status: { not: "CANCELLED" } }, select: { employeeId: true, type: true, principal: true, startMonth: true } });
  const key = (e: string, t: string, p: number, m: string) => `${e}|${t}|${p.toFixed(2)}|${m}`;
  const have = new Set(existing.map((l) => key(l.employeeId, l.type, Number(l.principal), l.startMonth)));
  let done = 0;

  for (const { row, values } of input) {
    const notes: ImportNote[] = [];
    const code = clean(values.employeeCode);
    const label = code || clean(values.employee) || undefined;
    const fail = (message: string) => { rows.push({ row, name: label, status: "error", message }); counts.failed++; };
    try {
      if (!ctx.user.canEditPay) { fail("You don't have permission to set pay, so loans can't be imported."); continue; }
      if (!code) { fail("Employee code is required: opening balances are matched by code, never by name."); continue; }
      const person = byCode.get(code.toLowerCase());
      if (!person) { fail(`No worker has the code ${code}.`); continue; }
      const name = clean(values.employee);
      if (name && person.name.toLowerCase().replace(/[^a-z]/g, "") !== name.toLowerCase().replace(/[^a-z]/g, "")) {
        notes.push({ tone: "warn", title: `Code ${code} is ${person.name}, the file says "${name}"`, detail: "Loaded against the code. Check it is the right person." });
      }

      const typeRaw = clean(values.type).toUpperCase();
      const type = !typeRaw || /^ADV/.test(typeRaw) ? "ADVANCE" : /^LOAN/.test(typeRaw) ? "LOAN" : null;
      if (!type) { fail(`Type "${clean(values.type)}" isn't Loan or Advance.`); continue; }

      const principal = amountOf(values.principal ?? "");
      if (principal === null || principal <= 0) { fail("The amount borrowed must be a number above zero."); continue; }
      const repaidRaw = clean(values.repaid);
      const repaid = repaidRaw ? amountOf(repaidRaw) : 0;
      if (repaid === null || repaid < 0) { fail(`Already repaid "${repaidRaw}" isn't a number.`); continue; }
      if (repaid > principal) { fail(`Already repaid (${repaid.toFixed(2)}) is more than the amount borrowed (${principal.toFixed(2)}).`); continue; }
      const balance = Math.round((principal - repaid) * 100) / 100;

      const instRaw = clean(values.instalment);
      let instalment = instRaw ? amountOf(instRaw) : null;
      if (balance > 0 && (instalment === null || instalment <= 0)) { fail("Monthly deduction is required while something is still owed."); continue; }
      if (balance > 0 && instalment! > balance) notes.push({ tone: "info", title: `Monthly deduction ${instalment!.toFixed(2)} is more than the balance ${balance.toFixed(2)}`, detail: "Payroll will only take what is left." });
      instalment = instalment ?? principal;

      const startRaw = clean(values.startMonth);
      let startMonth = thisMonth;
      if (startRaw) {
        const m = monthOf(startRaw);
        if (!m) { fail(`Start month "${startRaw}" isn't a month. Write it like 03/2026 or Mar 2026.`); continue; }
        startMonth = m;
      } else if (balance > 0) notes.push({ tone: "info", title: "No start month: deduction starts this month" });

      const givenRaw = clean(values.givenDate);
      const parsedGiven = givenRaw ? parseLooseDate(givenRaw) : null;
      if (givenRaw && !(parsedGiven instanceof Date)) { fail(`Hand-over date "${givenRaw}" isn't a date. Write it as day/month/year.`); continue; }
      let givenDate: Date | null = parsedGiven instanceof Date ? parsedGiven : null;
      if (!givenDate) { givenDate = new Date(); notes.push({ tone: "info", title: "No hand-over date: recorded as today", detail: "Payroll only recovers loans that have been handed over." }); }

      const k = key(person.id, type, principal, startMonth);
      if (have.has(k)) { rows.push({ row, name: person.name, status: "skipped", message: "This loan is already on record (same worker, type, amount and start month).", notes }); counts.skipped++; continue; }
      have.add(k);

      const reason = clean(values.reason).slice(0, 300) || "Opening balance";
      const cleared = balance === 0;
      const data = {
        type, principal, instalment, repaid, startMonth, reason, givenDate, method: "OTHER" as const,
        status: cleared ? "CLEARED" : "ACTIVE", approvalStatus: "APPROVED", approvedById: ctx.user.id, approvedAt: new Date(),
        decisionNote: "Opening balance imported", employeeId: person.id, branchId, createdById: ctx.user.id,
      };
      const created = await db.employeeLoan.create({ data });
      await audit({ entityType: "EMPLOYEE_LOAN", entityId: created.id, action: "CREATE", after: { ref: advanceRef(created.refNo), employee: person.name, type, principal, repaid, startMonth, imported: true }, userId: ctx.user.id, userName: ctx.user.name, branchId });
      rows.push({ row, name: person.name, status: "created", notes: cleared ? [...notes, { tone: "info", title: "Fully repaid: recorded as cleared" }] : notes });
      if (cleared) counts.cleared++; else counts.created++;
    } catch (e) {
      fail(e instanceof Error ? e.message : "Failed to import row.");
    }
    await ctx.progress?.(++done, input.length);
  }
  return { rows, counts, notes: [] };
}
