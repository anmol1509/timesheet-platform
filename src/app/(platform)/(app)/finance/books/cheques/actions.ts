"use server";

import { amountError } from "@/lib/books/validate";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite, requirePermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { syncPostings } from "@/lib/books/sync";
import { isLocked } from "@/lib/books/ledger";
import { r2, utcDay } from "@/lib/books/postings";
import { ownBankId } from "@/lib/books/banks";

type Result = { error?: string };
const day = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null);
const refresh = () => revalidatePath("/finance/books", "layout");

async function branchOf() {
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a company first." as const };
  const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { booksOpeningDate: true, booksLockedUntil: true } });
  if (!b?.booksOpeningDate) return { error: "Set up the books first." as const };
  return { user, branchId, opening: utcDay(b.booksOpeningDate), lockedUntil: b.booksLockedUntil ? utcDay(b.booksLockedUntil) : null };
}

export type ChequeInput = { direction: string; number: string; chequeDate: string; amount: number; partyType: string; partyId?: string; partyName: string; bankId?: string; counterAccountId?: string; narration: string };

export async function saveChequeAction(input: ChequeInput): Promise<Result> {
  await requireWrite("finance.books");
  const g = await branchOf();
  if ("error" in g) return { error: g.error };
  if (!["RECEIVED", "ISSUED"].includes(input.direction)) return { error: "Say whether it was received or issued." };
  const number = input.number.trim();
  if (!number) return { error: "Enter the cheque number." };
  const date = day(input.chequeDate);
  if (!date) return { error: "Enter the date on the cheque." };
  const amount = r2(Number(input.amount) || 0);
  { const bad = amountError(amount); if (bad) return { error: bad }; }
  if (!["CLIENT", "SUPPLIER", "OTHER"].includes(input.partyType)) return { error: "Choose who it is with." };
  let partyName = input.partyName.trim();
  let partyId: string | null = null;
  if (input.partyType === "CLIENT" || input.partyType === "SUPPLIER") {
    const p = input.partyId ? (input.partyType === "CLIENT" ? await prisma.client.findUnique({ where: { id: input.partyId }, select: { id: true, name: true, branchId: true } }) : await prisma.supplier.findUnique({ where: { id: input.partyId }, select: { id: true, name: true, branchId: true } })) : null;
    if (!p || (p.branchId && p.branchId !== g.branchId)) return { error: input.partyType === "CLIENT" ? "Choose the client." : "Choose the supplier." };
    partyId = p.id;
    partyName = p.name;
  } else if (!partyName) return { error: "Say who it is with." };
  let counter: string | null = null;
  if (input.partyType === "OTHER") {
    const a = input.counterAccountId ? await prisma.account.findUnique({ where: { id: input.counterAccountId }, select: { branchId: true, isActive: true } }) : null;
    if (!a || a.branchId !== g.branchId || !a.isActive) return { error: "Choose the account it belongs to." };
    counter = input.counterAccountId as string;
  }
  const bankId = await ownBankId(input.bankId, g.branchId);
  const c = await prisma.cheque.create({ data: { branchId: g.branchId, direction: input.direction, number, chequeDate: date, amount, partyType: input.partyType, partyId, partyName, bankId, counterAccountId: counter, narration: input.narration.trim() || null } });
  await logAudit({ entityType: "BOOKS", entityId: c.id, action: "CREATE", after: { cheque: number, amount, direction: input.direction }, userId: g.user.id, userName: g.user.name, branchId: g.branchId });
  refresh();
  return {};
}

export async function setChequeStatusAction(input: { id: string; status: string; clearedOn?: string }): Promise<Result> {
  await requireWrite("finance.books");
  const g = await branchOf();
  if ("error" in g) return { error: g.error };
  if (!["PENDING", "CLEARED", "BOUNCED", "CANCELLED"].includes(input.status)) return { error: "Unknown status." };
  const cur = await prisma.cheque.findUnique({ where: { id: input.id } });
  if (!cur || cur.branchId !== g.branchId) return { error: "Cheque not found." };
  let clearedOn: Date | null = null;
  if (input.status === "CLEARED") {
    clearedOn = day(input.clearedOn ?? "");
    if (!clearedOn) return { error: "Enter the day it cleared." };
    if (clearedOn.getTime() < g.opening.getTime()) return { error: "That is before your books start." };
    if (isLocked(clearedOn, g.lockedUntil)) return { error: "That period is locked." };
  }
  if (cur.status === "CLEARED" && cur.clearedOn && isLocked(utcDay(cur.clearedOn), g.lockedUntil)) return { error: "It cleared in a locked period, so it can't be changed." };
  await prisma.cheque.update({ where: { id: cur.id }, data: { status: input.status, clearedOn } });
  await logAudit({ entityType: "BOOKS", entityId: cur.id, action: "UPDATE", before: { status: cur.status }, after: { status: input.status }, userId: g.user.id, userName: g.user.name, branchId: g.branchId });
  await syncPostings(g.branchId);
  refresh();
  return {};
}

export async function deleteChequeAction(id: string): Promise<Result> {
  await requirePermission("finance.books", "delete");
  await requireWrite("finance.books");
  const g = await branchOf();
  if ("error" in g) return { error: g.error };
  const cur = await prisma.cheque.findUnique({ where: { id } });
  if (!cur || cur.branchId !== g.branchId) return { error: "Cheque not found." };
  if (cur.status === "CLEARED") return { error: "A cleared cheque is in the books. Mark it pending first, or leave it." };
  await prisma.cheque.delete({ where: { id } });
  refresh();
  return {};
}
