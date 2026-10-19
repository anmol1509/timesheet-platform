"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { syncPostings } from "@/lib/books/sync";
import { isLocked } from "@/lib/books/ledger";
import { r2, utcDay } from "@/lib/books/postings";

type Result = { error?: string };
const day = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null);

async function guard(date: Date) {
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." as const };
  const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { booksOpeningDate: true, booksLockedUntil: true } });
  if (!b?.booksOpeningDate) return { error: "Set up the books first." as const };
  if (isLocked(date, b.booksLockedUntil ? utcDay(b.booksLockedUntil) : null)) return { error: "That period is locked." as const };
  return { user, branchId, opening: utcDay(b.booksOpeningDate) };
}

async function ownAccount(id: string | undefined, branchId: string) {
  if (!id) return null;
  const a = await prisma.account.findUnique({ where: { id }, select: { branchId: true, isActive: true } });
  return a && a.branchId === branchId && a.isActive ? id : "bad";
}

export type AssetInput = { name: string; category: string; cost: number; salvage: number; purchaseDate: string; lifeMonths: number; paidFromAccountId?: string };

export async function saveAssetAction(input: AssetInput): Promise<Result> {
  await requireWrite("finance.books");
  const name = input.name.trim();
  if (!name) return { error: "Give the asset a name." };
  const cost = r2(Number(input.cost) || 0);
  const salvage = r2(Number(input.salvage) || 0);
  if (cost <= 0) return { error: "Enter what it cost." };
  if (salvage < 0 || salvage >= cost) return { error: "The value left at the end must be below the cost." };
  const life = Math.round(Number(input.lifeMonths));
  if (!Number.isFinite(life) || life < 1 || life > 600) return { error: "Useful life must be 1 to 600 months." };
  const date = day(input.purchaseDate);
  if (!date) return { error: "Choose the purchase date." };
  const g = await guard(date);
  if ("error" in g) return { error: g.error };
  const paid = await ownAccount(input.paidFromAccountId || undefined, g.branchId);
  if (paid === "bad") return { error: "Choose where the money came from." };
  if (paid && date.getTime() < g.opening.getTime()) return { error: "That purchase is before your books start, so it can't be posted. Leave 'Record the purchase' empty and carry it in the opening balances." };
  const a = await prisma.fixedAsset.create({ data: { branchId: g.branchId, name, category: input.category.trim() || null, cost, salvage, purchaseDate: date, lifeMonths: life, paidFromAccountId: paid } });
  await logAudit({ entityType: "BOOKS", entityId: a.id, action: "CREATE", after: { asset: name, cost }, userId: g.user.id, userName: g.user.name, branchId: g.branchId });
  await syncPostings(g.branchId);
  revalidatePath("/finance/books", "layout");
  return {};
}

export async function disposeAssetAction(input: { id: string; date: string; amount: number; accountId?: string }): Promise<Result> {
  await requireWrite("finance.books");
  const date = day(input.date);
  if (!date) return { error: "Choose the date it was sold or scrapped." };
  const g = await guard(date);
  if ("error" in g) return { error: g.error };
  const cur = await prisma.fixedAsset.findUnique({ where: { id: input.id } });
  if (!cur || cur.branchId !== g.branchId) return { error: "Asset not found." };
  if (cur.disposedOn) return { error: "Already sold or scrapped." };
  if (date.getTime() < utcDay(cur.purchaseDate).getTime()) return { error: "That is before it was bought." };
  const amount = r2(Number(input.amount) || 0);
  if (amount < 0) return { error: "The amount can't be negative." };
  const acct = await ownAccount(input.accountId || undefined, g.branchId);
  if (acct === "bad") return { error: "Choose where the money was paid in." };
  if (amount > 0 && !acct) return { error: "Choose where the money was paid in." };
  await prisma.fixedAsset.update({ where: { id: cur.id }, data: { disposedOn: date, disposalAmount: amount, disposalAccountId: acct } });
  await logAudit({ entityType: "BOOKS", entityId: cur.id, action: "UPDATE", after: { disposed: input.date, amount }, userId: g.user.id, userName: g.user.name, branchId: g.branchId });
  await syncPostings(g.branchId);
  revalidatePath("/finance/books", "layout");
  return {};
}

export async function deleteAssetAction(id: string): Promise<Result> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const cur = await prisma.fixedAsset.findUnique({ where: { id } });
  if (!cur || cur.branchId !== branchId) return { error: "Asset not found." };
  const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { booksLockedUntil: true } });
  if (b?.booksLockedUntil && isLocked(utcDay(cur.purchaseDate), utcDay(b.booksLockedUntil))) return { error: "Its purchase is in a locked period, so it can't be removed." };
  await prisma.fixedAsset.delete({ where: { id } });
  await logAudit({ entityType: "BOOKS", entityId: id, action: "DELETE", before: { asset: cur.name }, userId: user.id, userName: user.name, branchId });
  await syncPostings(branchId);
  revalidatePath("/finance/books", "layout");
  return {};
}
