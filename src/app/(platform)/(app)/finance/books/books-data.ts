import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can, canWrite } from "@/lib/permissions";
import { isAdminRole } from "@/lib/roles";
import { linkBankAccounts, syncIfStale } from "@/lib/books/sync";

/** Who is looking at the books, and what state the books are in. Redirects people without access. */
export async function getBooksContext() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  if (!can(subject, "finance.books", "view")) redirect("/no-access");
  const branch = branchId
    ? await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true, booksOpeningDate: true, booksLockedUntil: true, booksSyncedAt: true } })
    : null;
  const initialized = !!branch?.booksOpeningDate;
  if (branch && initialized) {
    await linkBankAccounts(branch.id);
    await syncIfStale(branch.id);
  }
  return { user, branch, branchId, initialized, canWrite: canWrite(subject, "finance.books"), isAdmin: isAdminRole(user.role) };
}

export type AccountRow = { id: string; code: string; name: string; type: string; tag: string | null; isSystem: boolean; isActive: boolean; debit: number; credit: number };

/** Every account with its debit and credit totals up to a date (inclusive), counting only posted entries. */
export async function accountsWithTotals(branchId: string, upTo?: Date, from?: Date): Promise<AccountRow[]> {
  const [accounts, sums] = await Promise.all([
    prisma.account.findMany({ where: { branchId }, orderBy: { code: "asc" } }),
    prisma.journalLine.groupBy({
      by: ["accountId"],
      where: { entry: { branchId, status: "POSTED", ...(upTo || from ? { date: { ...(from ? { gte: from } : {}), ...(upTo ? { lte: upTo } : {}) } } : {}) } },
      _sum: { debit: true, credit: true },
    }),
  ]);
  const by = new Map(sums.map((s) => [s.accountId, { debit: Number(s._sum.debit ?? 0), credit: Number(s._sum.credit ?? 0) }]));
  return accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, tag: a.tag, isSystem: a.isSystem, isActive: a.isActive, debit: by.get(a.id)?.debit ?? 0, credit: by.get(a.id)?.credit ?? 0 }));
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
