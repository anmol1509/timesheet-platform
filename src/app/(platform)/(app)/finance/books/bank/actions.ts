"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { reserveNumbers } from "@/lib/books/sync";
import { isLocked } from "@/lib/books/ledger";
import { r2, utcDay } from "@/lib/books/postings";
import { lineHashes, type StatementLine } from "@/lib/books/bankStatement";

type Result = { error?: string };
const refresh = () => revalidatePath("/finance/books/bank");

/** A cash or bank account of this branch: any asset account the books keep. */
async function ownAccount(branchId: string, accountId: string) {
  const a = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, branchId: true, type: true, name: true } });
  return a && a.branchId === branchId && a.type === "ASSET" ? a : null;
}

/** The ledger movement of an entry on one account (debit less credit): what the bank statement should show for it. */
async function entryAmount(entryId: string, accountId: string) {
  const e = await prisma.journalEntry.findUnique({ where: { id: entryId }, select: { branchId: true, status: true, lines: { where: { accountId }, select: { debit: true, credit: true } } } });
  if (!e || e.status !== "POSTED" || e.lines.length === 0) return null;
  return { branchId: e.branchId, amount: r2(e.lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)) };
}

/** Saves the lines of an uploaded statement. Lines already uploaded (an overlapping statement) are skipped. */
export async function importStatementAction(accountId: string, lines: StatementLine[]): Promise<Result & { added?: number; duplicates?: number }> {
  await requireWrite("finance.books");
  const { branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  if (!(await ownAccount(branchId, accountId))) return { error: "Choose the bank account this statement is for." };
  const clean = lines.filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.date) && Number.isFinite(l.amount) && l.amount !== 0).slice(0, 5000);
  if (clean.length === 0) return { error: "No transactions to add." };
  const hashes = lineHashes(clean);
  const res = await prisma.bankStatementLine.createMany({
    data: clean.map((l, i) => ({ branchId, accountId, date: new Date(`${l.date}T00:00:00.000Z`), description: l.description.slice(0, 300), reference: l.reference?.slice(0, 80) ?? null, amount: l.amount, balance: l.balance ?? null, importHash: hashes[i] })),
    skipDuplicates: true,
  });
  refresh();
  return { added: res.count, duplicates: clean.length - res.count };
}

/** Matches one statement line to one ledger entry when they agree on the amount and the entry isn't already used. */
async function applyMatch(statementId: string, entryId: string, who: string, branchId: string): Promise<Result> {
  const s = await prisma.bankStatementLine.findUnique({ where: { id: statementId } });
  if (!s || s.branchId !== branchId) return { error: "Statement line not found." };
  if (s.entryId) return { error: "That line is already matched." };
  const e = await entryAmount(entryId, s.accountId);
  if (!e || e.branchId !== branchId) return { error: "That entry isn't on this account." };
  if (e.amount !== r2(Number(s.amount))) return { error: `The amounts differ: bank ${Number(s.amount).toFixed(2)}, books ${e.amount.toFixed(2)}.` };
  if (await prisma.bankStatementLine.count({ where: { entryId } })) return { error: "That entry is already matched to another line." };
  await prisma.bankStatementLine.update({ where: { id: statementId }, data: { entryId, matchedAt: new Date(), matchedByName: who } });
  return {};
}

export async function matchStatementLineAction(statementId: string, entryId: string): Promise<Result> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const r = await applyMatch(statementId, entryId, user.name, branchId);
  refresh();
  return r;
}

/** Accepts a batch of suggested pairs; ones that no longer fit are skipped. */
export async function acceptMatchesAction(pairs: { statementId: string; entryId: string }[]): Promise<Result & { matched?: number }> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  let matched = 0;
  for (const p of pairs.slice(0, 500)) if (!(await applyMatch(p.statementId, p.entryId, user.name, branchId)).error) matched++;
  refresh();
  return { matched };
}

export async function unmatchStatementLineAction(statementId: string): Promise<Result> {
  await requireWrite("finance.books");
  const { branchId } = await requireUserWithBranch();
  const s = await prisma.bankStatementLine.findUnique({ where: { id: statementId }, select: { branchId: true } });
  if (!s || s.branchId !== branchId) return { error: "Statement line not found." };
  await prisma.bankStatementLine.update({ where: { id: statementId }, data: { entryId: null, matchedAt: null, matchedByName: null } });
  refresh();
  return {};
}

/** A statement line the books don't have yet (bank charges, interest, a transfer): posts it against another account and matches it. */
export async function addEntryForStatementLineAction(statementId: string, counterAccountId: string, narration: string): Promise<Result> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const s = await prisma.bankStatementLine.findUnique({ where: { id: statementId } });
  if (!s || s.branchId !== branchId) return { error: "Statement line not found." };
  if (s.entryId) return { error: "That line is already matched." };
  if (counterAccountId === s.accountId) return { error: "Choose a different account for the other side." };
  const counter = await prisma.account.findUnique({ where: { id: counterAccountId }, select: { branchId: true, isActive: true } });
  if (!counter || counter.branchId !== branchId || !counter.isActive) return { error: "That account isn't available." };
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { booksOpeningDate: true, booksLockedUntil: true } });
  if (!branch?.booksOpeningDate) return { error: "Set up the books first." };
  const date = utcDay(s.date);
  if (date.getTime() < utcDay(branch.booksOpeningDate).getTime()) return { error: "That is before your books start. Earlier figures belong in the opening balances." };
  if (isLocked(date, branch.booksLockedUntil ? utcDay(branch.booksLockedUntil) : null)) return { error: "That period is locked." };
  const text = narration.trim() || s.description;
  const amount = r2(Math.abs(Number(s.amount)));
  const inflow = Number(s.amount) > 0;
  const [number] = await reserveNumbers(branchId, "JV", 1);
  const entry = await prisma.journalEntry.create({
    data: {
      branchId, number, date, type: "JOURNAL", narration: text, createdById: user.id, createdByName: user.name,
      lines: { create: [
        { accountId: s.accountId, debit: inflow ? amount : 0, credit: inflow ? 0 : amount },
        { accountId: counterAccountId, debit: inflow ? 0 : amount, credit: inflow ? amount : 0 },
      ] },
    },
  });
  await prisma.bankStatementLine.update({ where: { id: statementId }, data: { entryId: entry.id, matchedAt: new Date(), matchedByName: user.name } });
  await logAudit({ entityType: "JOURNAL_ENTRY", entityId: entry.id, action: "CREATE", after: { number, from: "bank statement", total: amount }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/finance/books", "layout");
  return {};
}

/** Removes the statement lines not yet matched, so a corrected file can be uploaded again. */
export async function clearUnmatchedStatementAction(accountId: string): Promise<Result & { removed?: number }> {
  await requireWrite("finance.books");
  const { branchId } = await requireUserWithBranch();
  if (!branchId || !(await ownAccount(branchId, accountId))) return { error: "Account not found." };
  const r = await prisma.bankStatementLine.deleteMany({ where: { accountId, entryId: null } });
  refresh();
  return { removed: r.count };
}
