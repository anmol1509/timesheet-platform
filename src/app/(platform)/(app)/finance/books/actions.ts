"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUserWithBranch, requireWrite } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ACCOUNT_TYPES, VOUCHER_PREFIX } from "@/lib/books/chart";
import { readPolicy, type Policy } from "@/lib/books/accruals";
import type { Prisma } from "@/generated/prisma/client";
import { ensureChart, reserveNumbers, syncPostings } from "@/lib/books/sync";
import { isLocked } from "@/lib/books/ledger";
import { r2, totals, utcDay } from "@/lib/books/postings";

type Result = { error?: string };
const refresh = () => {
  revalidatePath("/finance/books", "layout");
};

const parseDay = (s: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

async function branchState(branchId: string) {
  return prisma.branch.findUnique({ where: { id: branchId }, select: { booksOpeningDate: true, booksLockedUntil: true } });
}

/** Starts the books on an opening date: creates the chart of accounts and brings the ledger up to date from there. */
export async function setupBooksAction(openingDate: string): Promise<Result> {
  await requireAdmin();
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const date = parseDay(openingDate);
  if (!date) return { error: "Choose the date your books start from." };
  const existing = await branchState(branchId);
  if (existing?.booksOpeningDate) return { error: "The books are already set up." };
  await ensureChart(branchId);
  await prisma.branch.update({ where: { id: branchId }, data: { booksOpeningDate: date } });
  const result = await syncPostings(branchId);
  await logAudit({ entityType: "BOOKS", entityId: branchId, action: "CREATE", after: { openingDate, posted: result.created }, userId: user.id, userName: user.name, branchId });
  refresh();
  return {};
}

/** Where money coming in from someone other than a client lands: the account it is credited to. */
export type MoneyInSource = "OTHER_INCOME" | "CAPITAL" | "STAFF_REPAYMENT" | "SUPPLIER_REFUND" | "OTHER";
const SOURCE_TAG: Record<Exclude<MoneyInSource, "OTHER">, string> = { OTHER_INCOME: "INCOME_OTHER", CAPITAL: "CAPITAL", STAFF_REPAYMENT: "STAFF_ADVANCES", SUPPLIER_REFUND: "COST_SUPPLIERS" };

/** Money received that is not a client payment: other income, owner's capital, a staff repayment, a refund, a loan... */
export async function receiveMoneyAction(input: { source: MoneyInSource; from: string; date: string; amount: number; narration: string; moneyAccountId: string; creditAccountId?: string }): Promise<Result & { number?: string }> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const date = parseDay(input.date);
  if (!date) return { error: "Choose a date." };
  const amount = r2(Number(input.amount) || 0);
  if (amount <= 0) return { error: "Enter an amount." };
  const from = input.from.trim();
  if (!from) return { error: "Say who it is from." };
  const state = await branchState(branchId);
  if (!state?.booksOpeningDate) return { error: "Set up the books first." };
  if (date.getTime() < utcDay(state.booksOpeningDate).getTime()) return { error: "That is before your books start. Earlier figures belong in the opening balances." };
  if (isLocked(date, state.booksLockedUntil ? utcDay(state.booksLockedUntil) : null)) return { error: "That period is locked." };
  const money = await prisma.account.findUnique({ where: { id: input.moneyAccountId }, select: { branchId: true, type: true, isActive: true } });
  if (!money || money.branchId !== branchId || money.type !== "ASSET" || !money.isActive) return { error: "Choose where the money was paid in." };
  let creditId: string | undefined;
  if (input.source === "OTHER") {
    const a = input.creditAccountId ? await prisma.account.findUnique({ where: { id: input.creditAccountId }, select: { branchId: true, isActive: true } }) : null;
    if (!a || a.branchId !== branchId || !a.isActive) return { error: "Choose what the money is for." };
    if (input.creditAccountId === input.moneyAccountId) return { error: "Pick a different account from the one the money is paid in to." };
    creditId = input.creditAccountId;
  } else {
    creditId = (await prisma.account.findFirst({ where: { branchId, tag: SOURCE_TAG[input.source] }, select: { id: true } }))?.id;
    if (!creditId) return { error: "That account is missing from your chart. Open Set-up first." };
  }
  const narration = `${from}${input.narration.trim() ? ` — ${input.narration.trim()}` : ""}`;
  const [number] = await reserveNumbers(branchId, VOUCHER_PREFIX.RECEIPT, 1);
  const entry = await prisma.journalEntry.create({
    data: { branchId, number, date, type: "RECEIPT", narration, createdById: user.id, createdByName: user.name, lines: { create: [{ accountId: input.moneyAccountId, debit: amount, credit: 0 }, { accountId: creditId as string, debit: 0, credit: amount }] } },
  });
  await logAudit({ entityType: "JOURNAL_ENTRY", entityId: entry.id, action: "CREATE", after: { number, type: "RECEIPT", source: input.source, from, total: amount }, userId: user.id, userName: user.name, branchId });
  refresh();
  return { number };
}

export type VoucherInput = { date: string; narration: string; lines: { accountId: string; debit: number; credit: number; description?: string }[] };

/** A manual journal voucher. Must balance, sit after the opening date and outside any locked period. */
export async function createVoucherAction(input: VoucherInput): Promise<Result & { number?: string }> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const date = parseDay(input.date);
  if (!date) return { error: "Choose a date." };
  const narration = input.narration.trim();
  if (!narration) return { error: "Say what the voucher is for." };
  const lines = input.lines.filter((l) => (l.debit || 0) > 0 || (l.credit || 0) > 0).map((l) => ({ ...l, debit: r2(Number(l.debit) || 0), credit: r2(Number(l.credit) || 0) }));
  if (lines.length < 2) return { error: "A voucher needs at least two lines." };
  if (lines.some((l) => l.debit < 0 || l.credit < 0 || (l.debit > 0 && l.credit > 0))) return { error: "Each line is either a debit or a credit, not both." };
  const t = totals(lines);
  if (!t.balanced) return { error: `Debits (${t.debit.toFixed(2)}) and credits (${t.credit.toFixed(2)}) must be equal.` };
  const state = await branchState(branchId);
  if (!state?.booksOpeningDate) return { error: "Set up the books first." };
  if (date.getTime() < utcDay(state.booksOpeningDate).getTime()) return { error: "That is before your books start. Earlier figures belong in the opening balances." };
  if (isLocked(date, state.booksLockedUntil ? utcDay(state.booksLockedUntil) : null)) return { error: "That period is locked." };
  const accounts = await prisma.account.findMany({ where: { branchId, id: { in: [...new Set(lines.map((l) => l.accountId))] }, isActive: true }, select: { id: true } });
  if (accounts.length !== new Set(lines.map((l) => l.accountId)).size) return { error: "One of the accounts isn't available." };

  const [number] = await reserveNumbers(branchId, "JV", 1);
  const entry = await prisma.journalEntry.create({
    data: {
      branchId, number, date, type: "JOURNAL", narration, createdById: user.id, createdByName: user.name,
      lines: { create: lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description?.trim() || null })) },
    },
  });
  await logAudit({ entityType: "JOURNAL_ENTRY", entityId: entry.id, action: "CREATE", after: { number, date: input.date, narration, total: t.debit }, userId: user.id, userName: user.name, branchId });
  refresh();
  return { number };
}

/** Voids a manual voucher (it stays on record, out of the balances). System entries follow their source and cannot be voided. */
export async function voidVoucherAction(id: string, reason: string): Promise<Result> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const why = reason.trim();
  if (!why) return { error: "Say why it is being voided." };
  const entry = await prisma.journalEntry.findUnique({ where: { id }, select: { branchId: true, sourceKey: true, status: true, date: true, number: true, type: true } });
  if (!entry || entry.branchId !== branchId) return { error: "Voucher not found." };
  if (entry.sourceKey) return { error: "This was posted automatically. Change the invoice, bill or payment it came from instead." };
  if (entry.status === "VOID") return { error: "Already voided." };
  const state = await branchState(branchId);
  if (isLocked(utcDay(entry.date), state?.booksLockedUntil ? utcDay(state.booksLockedUntil) : null)) return { error: "That period is locked." };
  await prisma.journalEntry.update({ where: { id }, data: { status: "VOID", voidReason: why } });
  await logAudit({ entityType: "JOURNAL_ENTRY", entityId: id, action: "UPDATE", before: { status: "POSTED" }, after: { status: "VOID", reason: why }, userId: user.id, userName: user.name, branchId });
  refresh();
  return {};
}

/** Adds an account, or renames/re-types one. System accounts keep their type and role. */
export async function saveAccountAction(input: { id?: string; code: string; name: string; type: string }): Promise<Result> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const code = input.code.trim();
  const name = input.name.trim();
  if (!/^[0-9A-Za-z.\-]{1,12}$/.test(code)) return { error: "Give the account a short code (letters, numbers, - or .)." };
  if (!name) return { error: "Give the account a name." };
  if (!(ACCOUNT_TYPES as readonly string[]).includes(input.type)) return { error: "Choose a type." };
  const clash = await prisma.account.findFirst({ where: { branchId, code, ...(input.id ? { NOT: { id: input.id } } : {}) }, select: { id: true } });
  if (clash) return { error: `Code ${code} is already used.` };
  if (input.id) {
    const cur = await prisma.account.findUnique({ where: { id: input.id } });
    if (!cur || cur.branchId !== branchId) return { error: "Account not found." };
    if (cur.isSystem && cur.type !== input.type) return { error: "This account is used for automatic postings, so its type can't change." };
    if (cur.type !== input.type) {
      const used = await prisma.journalLine.count({ where: { accountId: cur.id } });
      if (used > 0) return { error: "This account already has postings, so its type can't change." };
    }
    await prisma.account.update({ where: { id: cur.id }, data: { code, name, type: input.type } });
    await logAudit({ entityType: "ACCOUNT", entityId: cur.id, action: "UPDATE", before: { code: cur.code, name: cur.name, type: cur.type }, after: { code, name, type: input.type }, userId: user.id, userName: user.name, branchId });
  } else {
    const created = await prisma.account.create({ data: { branchId, code, name, type: input.type } });
    await logAudit({ entityType: "ACCOUNT", entityId: created.id, action: "CREATE", after: { code, name, type: input.type }, userId: user.id, userName: user.name, branchId });
  }
  refresh();
  return {};
}

/** Hides an account that is no longer used. It must be empty, and system accounts stay. */
export async function setAccountActiveAction(id: string, active: boolean): Promise<Result> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const acc = await prisma.account.findUnique({ where: { id } });
  if (!acc || acc.branchId !== branchId) return { error: "Account not found." };
  if (!active) {
    if (acc.isSystem) return { error: "The system posts to this account, so it can't be hidden." };
    const s = await prisma.journalLine.aggregate({ where: { accountId: id, entry: { status: "POSTED" } }, _sum: { debit: true, credit: true } });
    if (r2(Number(s._sum.debit ?? 0) - Number(s._sum.credit ?? 0)) !== 0) return { error: "This account still has a balance." };
  }
  await prisma.account.update({ where: { id }, data: { isActive: active } });
  await logAudit({ entityType: "ACCOUNT", entityId: id, action: "UPDATE", before: { isActive: acc.isActive }, after: { isActive: active }, userId: user.id, userName: user.name, branchId });
  refresh();
  return {};
}

/** Locks every entry on or before a date, or unlocks with an empty date. Admin only. */
export async function lockBooksAction(date: string | null): Promise<Result> {
  await requireAdmin();
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const d = date ? parseDay(date) : null;
  if (date && !d) return { error: "That date isn't valid." };
  const before = await branchState(branchId);
  if (!before?.booksOpeningDate) return { error: "Set up the books first." };
  await prisma.branch.update({ where: { id: branchId }, data: { booksLockedUntil: d } });
  await logAudit({ entityType: "BOOKS", entityId: branchId, action: "UPDATE", before: { lockedUntil: before.booksLockedUntil }, after: { lockedUntil: d }, userId: user.id, userName: user.name, branchId });
  refresh();
  return {};
}

/**
 * Saves the opening balances as one entry on the opening date. Anything that doesn't balance is put to Opening
 * balance equity, so the books always open balanced. Replaces the earlier opening entry.
 */
export async function saveOpeningBalancesAction(rows: { accountId: string; debit: number; credit: number }[]): Promise<Result & { plug?: number }> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const state = await branchState(branchId);
  if (!state?.booksOpeningDate) return { error: "Set up the books first." };
  const date = utcDay(state.booksOpeningDate);
  if (isLocked(date, state.booksLockedUntil ? utcDay(state.booksLockedUntil) : null)) return { error: "The opening date is in a locked period." };
  const lines = rows.map((r) => ({ accountId: r.accountId, debit: r2(Number(r.debit) || 0), credit: r2(Number(r.credit) || 0) }));
  if (lines.some((l) => l.debit > 0 && l.credit > 0)) return { error: "Each account takes a debit or a credit, not both." };
  const equity = await prisma.account.findFirst({ where: { branchId, tag: "OPENING_EQUITY" }, select: { id: true } });
  if (!equity) return { error: "The Opening balance equity account is missing." };
  const ids = [...new Set(lines.map((l) => l.accountId))];
  const ok = await prisma.account.count({ where: { branchId, id: { in: ids } } });
  if (ok !== ids.length) return { error: "One of the accounts isn't available." };
  // Amounts already split by client or supplier stay split: only the part not assigned to anyone follows the row.
  const prior = await prisma.journalLine.findMany({ where: { entry: { branchId, sourceKey: "opening" }, partyId: { not: null } }, select: { accountId: true, debit: true, credit: true, partyType: true, partyId: true } });
  const tagged = prior.map((l) => ({ accountId: l.accountId, debit: Number(l.debit), credit: Number(l.credit), partyType: l.partyType ?? undefined, partyId: l.partyId ?? undefined }));
  const split = lines.filter((l) => l.debit > 0 || l.credit > 0 || tagged.some((t) => t.accountId === l.accountId)).map((l) => {
    const t = r2(tagged.filter((x) => x.accountId === l.accountId).reduce((n, x) => n + x.debit - x.credit, 0));
    const rest = r2(l.debit - l.credit - t);
    return { accountId: l.accountId, debit: rest > 0 ? rest : 0, credit: rest < 0 ? -rest : 0 };
  }).filter((l) => l.debit > 0 || l.credit > 0);
  const keep = tagged.filter((t) => lines.some((l) => l.accountId === t.accountId));
  const t = totals([...split, ...keep]);
  const plug = r2(t.debit - t.credit);
  const all: { accountId: string; debit: number; credit: number; partyType?: string; partyId?: string }[] = [...split, ...keep, ...(plug === 0 ? [] : [plug > 0 ? { accountId: equity.id, debit: 0, credit: plug } : { accountId: equity.id, debit: -plug, credit: 0 }])];

  const existing = await prisma.journalEntry.findFirst({ where: { branchId, sourceKey: "opening" }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    if (existing) await tx.journalLine.deleteMany({ where: { entryId: existing.id } });
    if (all.length === 0) {
      if (existing) await tx.journalEntry.delete({ where: { id: existing.id } });
      return;
    }
    if (existing) {
      await tx.journalEntry.update({ where: { id: existing.id }, data: { date, narration: "Opening balances", status: "POSTED" } });
      await tx.journalLine.createMany({ data: all.map((l) => ({ entryId: existing.id, ...l })) });
    } else {
      const [number] = await reserveNumbers(branchId, "OB", 1);
      await tx.journalEntry.create({ data: { branchId, number, date, type: "OPENING", narration: "Opening balances", sourceKey: "opening", createdById: user.id, createdByName: user.name, lines: { create: all } } });
    }
  });
  await logAudit({ entityType: "BOOKS", entityId: branchId, action: "UPDATE", after: { openingBalances: all.length, plug }, userId: user.id, userName: user.name, branchId });
  refresh();
  return { plug };
}

/** Brings automatic postings up to date right now. */
export async function refreshPostingsAction(): Promise<Result & { created?: number; updated?: number; removed?: number; unmapped?: string[] }> {
  await requireWrite("finance.books");
  const { branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const r = await syncPostings(branchId);
  refresh();
  return { created: r.created, updated: r.updated, removed: r.removed, unmapped: r.unmapped };
}

export type ImportRow = { accountId?: string; newCode?: string; newName?: string; newType?: string; debit: number; credit: number };

/**
 * Brings opening balances in from another system's trial balance. Rows pointing at an existing account use it;
 * the rest create a new account first. Replaces the earlier opening entry, and any difference is parked in
 * Opening balance equity so the books still balance (the wizard shows it before this runs).
 */
export async function importOpeningBalancesAction(rows: ImportRow[]): Promise<Result & { plug?: number; created?: number }> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const state = await branchState(branchId);
  if (!state?.booksOpeningDate) return { error: "Set up the books first." };
  const existing = await prisma.account.findMany({ where: { branchId }, select: { id: true, code: true } });
  const usedCodes = new Set(existing.map((a) => a.code));
  const byAccount = new Map<string, { debit: number; credit: number }>();
  let created = 0;
  for (const r of rows) {
    if (!(r.debit > 0 || r.credit > 0)) continue;
    let id = r.accountId;
    if (id) {
      if (!existing.some((a) => a.id === id)) return { error: "One of the accounts isn't available." };
    } else {
      const name = r.newName?.trim();
      if (!name || !r.newType || !(ACCOUNT_TYPES as readonly string[]).includes(r.newType)) return { error: `Choose where “${name || "a row"}” goes.` };
      // New accounts take the next free code in their type's range, unless the source gave a free one.
      let code = r.newCode?.trim() && /^[0-9A-Za-z.\-]{1,12}$/.test(r.newCode.trim()) && !usedCodes.has(r.newCode.trim()) ? r.newCode.trim() : "";
      if (!code) {
        const base = { ASSET: 1800, LIABILITY: 2600, EQUITY: 3300, INCOME: 4300, EXPENSE: 5800 }[r.newType as "ASSET"];
        let n = base;
        while (usedCodes.has(String(n))) n++;
        code = String(n);
      }
      const acc = await prisma.account.create({ data: { branchId, code, name, type: r.newType } });
      usedCodes.add(code);
      existing.push({ id: acc.id, code });
      id = acc.id;
      created++;
    }
    const cur = byAccount.get(id) ?? { debit: 0, credit: 0 };
    byAccount.set(id, { debit: cur.debit + r.debit, credit: cur.credit + r.credit });
  }
  const merged = [...byAccount.entries()].map(([accountId, v]) => {
    const net = r2(v.debit - v.credit);
    return { accountId, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
  });
  const saved = await saveOpeningBalancesAction(merged);
  if (saved.error) return saved;
  await logAudit({ entityType: "BOOKS", entityId: branchId, action: "UPDATE", after: { imported: merged.length, newAccounts: created }, userId: user.id, userName: user.name, branchId });
  return { plug: saved.plug, created };
}

/** Which staff provisions the books set aside each month. Takes effect on the next refresh; closed (locked) months stay as they are. */
export async function saveProvisionSettingsAction(input: { gratuity: boolean; leave: boolean; tickets: boolean; policy: Policy }): Promise<Result> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const policy = readPolicy(input.policy);
  const g = policy.gratuity;
  if (g.daysFirst > 0 && g.capMonths <= 0) return { error: "Set a gratuity cap of at least 1 month, or 0 days to turn it off." };
  const data = { accrueGratuity: !!input.gratuity, accrueLeave: !!input.leave, accrueTickets: !!input.tickets, provisionPolicy: policy as unknown as Prisma.InputJsonValue };
  await prisma.branch.update({ where: { id: branchId }, data });
  await logAudit({ entityType: "BOOKS", entityId: branchId, action: "UPDATE", after: data, userId: user.id, userName: user.name, branchId });
  const result = await syncPostings(branchId);
  refresh();
  return result.skippedLocked > 0 ? { error: `Saved, but ${result.skippedLocked} entries fall in a locked period and were left as they are.` } : {};
}
