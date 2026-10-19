import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { DEFAULT_CHART, VOUCHER_PREFIX } from "./chart";
import { billPostings, expensePostings, hashPosting, invoicePostings, loanPostings, payrollPostings, settlementPostings, topUpPostings, r2, totals, utcDay, type Posting } from "./postings";
import { isLocked } from "./ledger";
import { costTag, customPostings, provisionTag, type CustomRule, type RuleStaff } from "./customProvisions";
import { accrualPostings, monthsBetween, readPolicy } from "./accruals";

const SYNC_MAX_AGE_MS = 30_000;
const CHUNK = 400;

/** Creates the chart of accounts for a branch that has none. Safe to call again. */
export async function ensureChart(branchId: string) {
  const have = await prisma.account.count({ where: { branchId } });
  if (have > 0) return;
  await prisma.account.createMany({
    data: DEFAULT_CHART.map((c) => ({ branchId, code: c.code, name: c.name, type: c.type, tag: c.tag ?? null, isSystem: !!c.tag })),
    skipDuplicates: true,
  });
}

/** Adds the staff-provision accounts to a chart made before they existed. Safe to call repeatedly. */
export async function ensureProvisionAccounts(branchId: string) {
  const wanted = DEFAULT_CHART.filter((c) => c.tag && /^(EOSB|PROVISION_|EXP_EOSB|EXP_LEAVE|EXP_TICKETS)/.test(c.tag));
  const have = await prisma.account.findMany({ where: { branchId }, select: { code: true, tag: true } });
  const tags = new Set(have.map((a) => a.tag));
  const codes = new Set(have.map((a) => a.code));
  for (const c of wanted) {
    if (tags.has(c.tag as string)) continue;
    let code = Number(c.code);
    while (codes.has(String(code))) code += 1;
    codes.add(String(code));
    await prisma.account.create({ data: { branchId, code: String(code), name: c.name, type: c.type, tag: c.tag, isSystem: true } });
  }
}

/** Gives each custom provision a liability and a cost account. Safe to call repeatedly. */
export async function ensureRuleAccounts(branchId: string) {
  const rules = await prisma.provisionRule.findMany({ where: { branchId }, select: { id: true, name: true } });
  if (!rules.length) return;
  const have = await prisma.account.findMany({ where: { branchId }, select: { code: true, tag: true } });
  const tags = new Set(have.map((a) => a.tag));
  const codes = new Set(have.map((a) => a.code));
  const next = (from: number, to: number) => {
    let c = from;
    while (codes.has(String(c))) c += 1;
    if (c >= to) c = to; // out of room: fall through to the next free code after `to`
    while (codes.has(String(c))) c += 1;
    codes.add(String(c));
    return String(c);
  };
  for (const r of rules) {
    if (!tags.has(provisionTag(r.id))) await prisma.account.create({ data: { branchId, code: next(2430, 2499), name: `${r.name} provision`, type: "LIABILITY", tag: provisionTag(r.id), isSystem: true } });
    if (!tags.has(costTag(r.id))) await prisma.account.create({ data: { branchId, code: next(5140, 5149), name: `${r.name} cost`, type: "EXPENSE", tag: costTag(r.id), isSystem: true } });
  }
}

/** "Emirates NBD · ···1234 (AED)": the ledger name for a company bank account. */
export function bankLedgerName(b: { bankName: string; accountName: string; accountNo: string | null; ibanNo: string | null; currency: string }) {
  const digits = (b.accountNo || b.ibanNo || "").replace(/\s/g, "");
  const tail = digits ? ` · ···${digits.slice(-4)}` : ` · ${b.accountName}`;
  return `${b.bankName}${tail} (${b.currency})`;
}

/**
 * Gives every active company bank account its own ledger account, named after the real bank. The generic
 * "Bank — main account" (the account the system posts to) is taken over by the first bank, so postings keep working.
 * Safe to call repeatedly.
 */
export async function linkBankAccounts(branchId: string) {
  const [banks, accounts] = await Promise.all([
    prisma.bank.findMany({ where: { branchId, status: { not: "INACTIVE" } }, orderBy: [{ bankName: "asc" }, { accountName: "asc" }] }),
    prisma.account.findMany({ where: { branchId }, select: { id: true, code: true, tag: true, name: true, bankId: true } }),
  ]);
  if (!banks.length) return;
  const byBank = new Map(accounts.filter((a) => a.bankId).map((a) => [a.bankId as string, a]));
  const main = accounts.find((a) => a.tag === "BANK" && !a.bankId);
  let mainFree = !!main && !accounts.some((a) => a.tag === "BANK" && a.bankId);
  let nextCode = Math.max(1100, ...accounts.map((a) => Number(a.code)).filter((n) => n >= 1100 && n < 1200)) + 1;
  const taken = new Set(accounts.map((a) => a.code));
  for (const b of banks) {
    const name = bankLedgerName(b);
    const have = byBank.get(b.id);
    if (have) {
      if (have.name !== name) await prisma.account.update({ where: { id: have.id }, data: { name } });
      continue;
    }
    if (mainFree && main) {
      mainFree = false;
      await prisma.account.update({ where: { id: main.id }, data: { bankId: b.id, name } });
      continue;
    }
    while (taken.has(String(nextCode))) nextCode++;
    if (nextCode >= 1200) break;
    await prisma.account.create({ data: { branchId, code: String(nextCode), name, type: "ASSET", bankId: b.id } });
    taken.add(String(nextCode));
  }
}

/** The next voucher numbers for a prefix, reserved so two writers never share one. */
export async function reserveNumbers(branchId: string, prefix: string, count: number): Promise<string[]> {
  if (count <= 0) return [];
  const seq = await prisma.bookSequence.upsert({
    where: { branchId_prefix: { branchId, prefix } },
    create: { branchId, prefix, next: count + 1 },
    update: { next: { increment: count } },
  });
  const first = seq.next - count;
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(first + i).padStart(4, "0")}`);
}

export type SyncResult = { created: number; updated: number; removed: number; skippedLocked: number; unmapped: string[] };

/** Everything the business has done, as postings dated on or after `opening`. */
async function gatherPostings(branchId: string, opening: Date): Promise<Posting[]> {
  const scope = branchWhere(branchId);
  const since = opening;
  const openMonth = `${opening.getUTCFullYear()}-${String(opening.getUTCMonth() + 1).padStart(2, "0")}`;
  const [invoices, bills, expenses, runs, loans, topUps, branchRow, people, settlements, openingLines, rules] = await Promise.all([
    prisma.clientInvoice.findMany({ where: { ...scope, OR: [{ issueDate: { gte: since } }, { paidDate: { gte: since } }] }, include: { client: { select: { name: true } } } }),
    prisma.supplierBill.findMany({ where: { ...scope, approvalStatus: "APPROVED", OR: [{ billDate: { gte: since } }, { payments: { some: { paidOn: { gte: since } } } }] }, include: { supplier: { select: { name: true } }, payments: true } }),
    prisma.expense.findMany({ where: { ...scope, status: "APPROVED", OR: [{ date: { gte: since } }, { reimbursedAt: { gte: since } }] } }),
    prisma.payrollRun.findMany({ where: { ...scope, status: { in: ["APPROVED", "PAID"] }, OR: [{ month: { gte: openMonth } }, { paidAt: { gte: since } }] }, include: { lines: { select: { net: true, loanDeduction: true, paymentStatus: true, projectId: true } } } }),
    prisma.employeeLoan.findMany({ where: { ...scope, approvalStatus: "APPROVED", givenDate: { gte: since } }, include: { employee: { select: { name: true } } } }),
    prisma.pettyCashTopUp.findMany({ where: { ...scope, date: { gte: since } } }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { accrueGratuity: true, accrueLeave: true, accrueTickets: true, provisionPolicy: true } }),
    prisma.employee.findMany({
      where: { ...scope, joinDate: { not: null } },
      select: { id: true, joinDate: true, exitDate: true, payStructure: true, basicSalary: true, housingAllowance: true, foodAllowance: true, transportAllowance: true, otherAllowance: true, flatMonthlyRate: true, leaveDaysPerYear: true, airTicketAmount: true, airTicketEveryMonths: true, skipGratuity: true, category: true },
    }),
    prisma.finalSettlement.findMany({ where: { ...scope }, include: { employee: { select: { name: true } } } }),
    prisma.journalLine.findMany({ where: { entry: { branchId, sourceKey: "opening" }, account: { tag: { in: ["EOSB", "PROVISION_LEAVE", "PROVISION_TICKETS"] } } }, select: { debit: true, credit: true, account: { select: { tag: true } } } }),
    prisma.provisionRule.findMany({ where: { branchId }, orderBy: { createdAt: "asc" } }),
  ]);
  const on = { gratuity: !!branchRow?.accrueGratuity, leave: !!branchRow?.accrueLeave, tickets: !!branchRow?.accrueTickets };
  const companyIds = [...new Set(runs.map((r) => r.companyId).filter((x): x is string => !!x))];
  const companies = companyIds.length ? await prisma.supplier.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }) : [];
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  const out: Posting[] = [];
  for (const i of invoices) out.push(...invoicePostings({ id: i.id, invoiceNumber: i.invoiceNumber, clientId: i.clientId, clientName: i.client.name, status: i.status, issueDate: i.issueDate, paidDate: i.paidDate, subtotal: i.subtotal, vatAmount: i.vatAmount, totalAmount: i.totalAmount }));
  for (const b of bills) out.push(...billPostings({ id: b.id, billNo: b.billNo, supplierId: b.supplierId, supplierName: b.supplier.name, billDate: b.billDate, amount: Number(b.amount), vatAmount: Number(b.vatAmount), approvalStatus: b.approvalStatus, payments: b.payments.map((p) => ({ id: p.id, paidOn: p.paidOn, amount: Number(p.amount), method: p.method, reference: p.reference })) }));
  for (const e of expenses) out.push(...expensePostings({ id: e.id, date: e.date, category: e.category, description: e.description, amount: Number(e.amount), vatAmount: Number(e.vatAmount), paidTo: e.paidTo, paymentMethod: e.paymentMethod, outOfPocket: e.outOfPocket, reimbursedAt: e.reimbursedAt, projectId: e.projectId, status: e.status }));
  for (const r of runs) out.push(...payrollPostings({ id: r.id, month: r.month, status: r.status, approvedAt: r.approvedAt, paidAt: r.paidAt, label: (r.companyId && companyName.get(r.companyId)) || "all workers", lines: r.lines.map((l) => ({ net: Number(l.net), loanDeduction: Number(l.loanDeduction), paymentStatus: l.paymentStatus, projectId: l.projectId })) }));
  for (const l of loans) out.push(...loanPostings({ id: l.id, refNo: l.refNo, employeeId: l.employeeId, employeeName: l.employee.name, principal: Number(l.principal), approvalStatus: l.approvalStatus, givenDate: l.givenDate, method: l.method, type: l.type }));
  for (const t of topUps) out.push(...topUpPostings({ id: t.id, amount: Number(t.amount), date: t.date, note: t.note }));
  for (const st of settlements) out.push(...settlementPostings({ id: st.id, employeeId: st.employeeId, employeeName: st.employee.name, status: st.status, paidAt: st.paidAt, gratuity: Number(st.gratuity), unpaidSalary: Number(st.unpaidSalary), leavePay: Number(st.leavePay), noticePay: Number(st.noticePay), otherEarnings: Number(st.otherEarnings), loanBalance: Number(st.loanBalance), otherDeductions: Number(st.otherDeductions), fromGratuityProvision: on.gratuity, fromLeaveProvision: on.leave }));
  const settledOn = new Map(settlements.filter((x) => x.status === "PAID" && x.paidAt).map((x) => [x.employeeId, utcDay(x.paidAt as Date)]));
  const staff: RuleStaff[] = people.map((e) => {
    const itemised = e.payStructure === "ITEMISED";
    const flat = e.payStructure === "FLAT";
    const basic = itemised ? Number(e.basicSalary ?? 0) : flat ? Number(e.flatMonthlyRate ?? 0) : 0;
    const fixed = itemised ? basic + Number(e.housingAllowance ?? 0) + Number(e.foodAllowance ?? 0) + Number(e.transportAllowance ?? 0) + Number(e.otherAllowance ?? 0) : basic;
    return { id: e.id, category: e.category, joinDate: e.joinDate ? utcDay(e.joinDate) : null, exitDate: e.exitDate ? utcDay(e.exitDate) : null, settledOn: settledOn.get(e.id) ?? null, basic, fixed, leaveDaysPerYear: e.leaveDaysPerYear, ticketAmount: e.airTicketAmount == null ? null : Number(e.airTicketAmount), ticketEveryMonths: e.airTicketEveryMonths, skipGratuity: e.skipGratuity };
  });
  const today = utcDay(new Date());
  const lastDone = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)); // last day of the previous month
  const last = `${lastDone.getUTCFullYear()}-${String(lastDone.getUTCMonth() + 1).padStart(2, "0")}`;
  if (on.gratuity || on.leave || on.tickets) {
    const opening0 = { gratuity: 0, leave: 0, tickets: 0 };
    for (const l of openingLines) {
      const k = l.account.tag === "EOSB" ? "gratuity" : l.account.tag === "PROVISION_LEAVE" ? "leave" : "tickets";
      opening0[k] = r2(opening0[k] + Number(l.credit) - Number(l.debit));
    }
    const used = settlements
      .filter((x) => x.status === "PAID" && x.paidAt)
      .map((x) => ({ date: utcDay(x.paidAt as Date), amounts: { gratuity: on.gratuity ? Number(x.gratuity) : 0, leave: on.leave ? Number(x.leavePay) : 0 } }));
    if (openMonth <= last) out.push(...accrualPostings({ months: monthsBetween(openMonth, last), staff, on, policy: readPolicy(branchRow?.provisionPolicy), opening: opening0, used }));
  }
  const customRules: CustomRule[] = rules.map((r) => ({ id: r.id, name: r.name, method: r.method as CustomRule["method"], amount: Number(r.amount), everyMonths: r.everyMonths, appliesTo: r.appliesTo as CustomRule["appliesTo"], active: r.active }));
  if (customRules.length && openMonth <= last) {
    const tagToRule = new Map(customRules.map((r) => [provisionTag(r.id), r.id]));
    const ruleLines = await prisma.journalLine.findMany({
      where: { account: { branchId, tag: { in: [...tagToRule.keys()] } }, entry: { OR: [{ sourceKey: null }, { NOT: { sourceKey: { startsWith: "accrual" } } }] } },
      select: { debit: true, credit: true, account: { select: { tag: true } }, entry: { select: { date: true, sourceKey: true } } },
    });
    const opening: Record<string, number> = {};
    const used: { date: Date; ruleId: string; amount: number }[] = [];
    for (const l of ruleLines) {
      const id = tagToRule.get(l.account.tag as string) as string;
      if (l.entry.sourceKey === "opening") opening[id] = r2((opening[id] ?? 0) + Number(l.credit) - Number(l.debit));
      else used.push({ date: utcDay(l.entry.date), ruleId: id, amount: r2(Number(l.debit) - Number(l.credit)) });
    }
    out.push(...customPostings({ months: monthsBetween(openMonth, last), staff, rules: customRules, opening, used }));
  }
  return out.filter((p) => p.date.getTime() >= since.getTime());
}

/**
 * Brings the ledger up to date with what the business has done. Idempotent: an entry is created when its source
 * appears, rewritten when the source changes, and removed when the source goes away. Entries on or before the lock
 * date are never touched, and nothing before the opening date is posted (opening balances stand in for it).
 */
export async function syncPostings(branchId: string): Promise<SyncResult> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { booksOpeningDate: true, booksLockedUntil: true } });
  const result: SyncResult = { created: 0, updated: 0, removed: 0, skippedLocked: 0, unmapped: [] };
  if (!branch?.booksOpeningDate) return result;
  await ensureProvisionAccounts(branchId);
  await ensureRuleAccounts(branchId);
  const opening = utcDay(branch.booksOpeningDate);
  const locked = branch.booksLockedUntil ? utcDay(branch.booksLockedUntil) : null;

  const [desiredAll, accounts, existing] = await Promise.all([
    gatherPostings(branchId, opening),
    prisma.account.findMany({ where: { branchId, tag: { not: null } }, select: { id: true, tag: true } }),
    prisma.journalEntry.findMany({ where: { branchId, AND: [{ sourceKey: { not: null } }, { sourceKey: { not: "opening" } }] }, select: { id: true, sourceKey: true, sourceHash: true, date: true } }),
  ]);
  const accountByTag = new Map(accounts.map((a) => [a.tag as string, a.id]));
  const unmapped = new Set<string>();

  type Ready = { posting: Posting; hash: string; lines: { accountId: string; debit: number; credit: number; description?: string; partyType?: string; partyId?: string; projectId?: string }[] };
  const desired = new Map<string, Ready>();
  for (const p of desiredAll) {
    const lines = [];
    let missing = false;
    for (const l of p.lines) {
      const accountId = accountByTag.get(l.tag);
      if (!accountId) { unmapped.add(l.tag); missing = true; break; }
      lines.push({ accountId, debit: l.debit ?? 0, credit: l.credit ?? 0, description: l.description, partyType: l.partyType, partyId: l.partyId, projectId: l.projectId });
    }
    if (missing || !totals(p.lines).balanced) continue;
    desired.set(p.sourceKey, { posting: p, hash: hashPosting(p), lines });
  }
  result.unmapped = [...unmapped];

  const have = new Map(existing.map((e) => [e.sourceKey as string, e]));
  const toCreate: Ready[] = [];
  const toUpdate: { id: string; ready: Ready }[] = [];
  for (const [key, ready] of desired) {
    const cur = have.get(key);
    if (!cur) {
      if (isLocked(ready.posting.date, locked)) result.skippedLocked++;
      else toCreate.push(ready);
    } else if (cur.sourceHash !== ready.hash) {
      if (isLocked(utcDay(cur.date), locked) || isLocked(ready.posting.date, locked)) result.skippedLocked++;
      else toUpdate.push({ id: cur.id, ready });
    }
  }
  const toRemove = existing.filter((e) => !desired.has(e.sourceKey as string) && !isLocked(utcDay(e.date), locked)).map((e) => e.id);
  result.skippedLocked += existing.filter((e) => !desired.has(e.sourceKey as string) && isLocked(utcDay(e.date), locked)).length;

  // Numbers, one block per voucher prefix.
  const numbers = new Map<string, string[]>();
  const byPrefix = new Map<string, number>();
  for (const r of toCreate) byPrefix.set(VOUCHER_PREFIX[r.posting.type] ?? "JV", (byPrefix.get(VOUCHER_PREFIX[r.posting.type] ?? "JV") ?? 0) + 1);
  for (const [prefix, n] of byPrefix) numbers.set(prefix, await reserveNumbers(branchId, prefix, n));

  const lineData = (entryId: string, r: Ready) => r.lines.map((l) => ({ entryId, accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description ?? null, partyType: l.partyType ?? null, partyId: l.partyId ?? null, projectId: l.projectId ?? null }));

  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const slice = toCreate.slice(i, i + CHUNK).map((r) => ({ id: randomUUID(), r }));
    await prisma.$transaction([
      prisma.journalEntry.createMany({
        data: slice.map(({ id, r }) => ({ id, branchId, number: (numbers.get(VOUCHER_PREFIX[r.posting.type] ?? "JV") as string[]).shift() as string, date: r.posting.date, type: r.posting.type, narration: r.posting.narration, sourceKey: r.posting.sourceKey, sourceHash: r.hash, createdByName: "Auto" })),
      }),
      prisma.journalLine.createMany({ data: slice.flatMap(({ id, r }) => lineData(id, r)) }),
    ]);
    result.created += slice.length;
  }
  for (const u of toUpdate) {
    await prisma.$transaction([
      prisma.journalLine.deleteMany({ where: { entryId: u.id } }),
      prisma.journalEntry.update({ where: { id: u.id }, data: { date: u.ready.posting.date, type: u.ready.posting.type, narration: u.ready.posting.narration, sourceHash: u.ready.hash } }),
      prisma.journalLine.createMany({ data: lineData(u.id, u.ready) }),
    ]);
    result.updated++;
  }
  if (toRemove.length) {
    await prisma.journalEntry.deleteMany({ where: { id: { in: toRemove } } });
    result.removed = toRemove.length;
  }
  await prisma.branch.update({ where: { id: branchId }, data: { booksSyncedAt: new Date() } });
  return result;
}

/** Syncs unless it was done moments ago, so opening several books pages in a row stays quick. */
export async function syncIfStale(branchId: string): Promise<void> {
  const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { booksOpeningDate: true, booksSyncedAt: true } });
  if (!b?.booksOpeningDate) return;
  if (b.booksSyncedAt && Date.now() - b.booksSyncedAt.getTime() < SYNC_MAX_AGE_MS) return;
  await syncPostings(branchId);
}
