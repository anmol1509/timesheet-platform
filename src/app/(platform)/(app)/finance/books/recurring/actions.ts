"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { syncPostings } from "@/lib/books/sync";
import { r2 } from "@/lib/books/postings";

type Result = { error?: string };
const day = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null);

export type RecurringInput = { id?: string; name: string; frequency: string; startDate: string; endDate?: string; debitAccountId: string; creditAccountId: string; amount: number; active: boolean };

export async function saveRecurringAction(input: RecurringInput): Promise<Result> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const name = input.name.trim();
  if (!name) return { error: "Say what it is for, e.g. Office rent." };
  if (!["MONTHLY", "QUARTERLY", "YEARLY"].includes(input.frequency)) return { error: "Choose how often." };
  const start = day(input.startDate);
  if (!start) return { error: "Choose the first date." };
  const end = input.endDate ? day(input.endDate) : null;
  if (input.endDate && !end) return { error: "The last date isn't valid." };
  if (end && end.getTime() < start.getTime()) return { error: "The last date is before the first." };
  const amount = r2(Number(input.amount) || 0);
  if (amount <= 0) return { error: "Enter an amount." };
  if (!input.debitAccountId || !input.creditAccountId) return { error: "Choose both accounts." };
  if (input.debitAccountId === input.creditAccountId) return { error: "The two accounts must be different." };
  const accts = await prisma.account.findMany({ where: { id: { in: [input.debitAccountId, input.creditAccountId] }, branchId, isActive: true }, select: { id: true } });
  if (accts.length !== 2) return { error: "Choose accounts from your chart." };
  const data = { name, frequency: input.frequency, startDate: start, endDate: end, debitAccountId: input.debitAccountId, creditAccountId: input.creditAccountId, amount, active: !!input.active };
  if (input.id) {
    const cur = await prisma.recurringEntry.findUnique({ where: { id: input.id }, select: { branchId: true } });
    if (!cur || cur.branchId !== branchId) return { error: "Not found." };
    await prisma.recurringEntry.update({ where: { id: input.id }, data });
  } else {
    await prisma.recurringEntry.create({ data: { ...data, branchId } });
  }
  await logAudit({ entityType: "BOOKS", entityId: branchId, action: input.id ? "UPDATE" : "CREATE", after: { recurring: name, amount }, userId: user.id, userName: user.name, branchId });
  const result = await syncPostings(branchId);
  revalidatePath("/finance/books", "layout");
  return result.skippedLocked > 0 ? { error: `Saved, but ${result.skippedLocked} entries fall in a locked period and were left as they are.` } : {};
}

export async function deleteRecurringAction(id: string): Promise<Result> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const cur = await prisma.recurringEntry.findUnique({ where: { id } });
  if (!cur || cur.branchId !== branchId) return { error: "Not found." };
  await prisma.recurringEntry.delete({ where: { id } });
  await logAudit({ entityType: "BOOKS", entityId: id, action: "DELETE", before: { recurring: cur.name }, userId: user.id, userName: user.name, branchId });
  await syncPostings(branchId);
  revalidatePath("/finance/books", "layout");
  return {};
}
