"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { reserveNumbers } from "@/lib/books/sync";
import { isLocked } from "@/lib/books/ledger";
import { r2, totals, utcDay } from "@/lib/books/postings";
import { VOUCHER_PREFIX } from "@/lib/books/chart";

type Result = { error?: string };

/**
 * What a client owes us (or we owe a supplier) on the day the books start. It splits the opening figure on the
 * Receivable / Payable account by name instead of adding to it: any part of that account's opening balance not yet
 * assigned to someone shrinks by the same amount, so the account total only grows when the parties add up to more.
 */
export async function savePartyOpeningAction(type: "CLIENT" | "SUPPLIER", partyId: string, amount: number): Promise<Result> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const value = r2(Number(amount) || 0);
  if (value < 0) return { error: "Enter what they owed at the start as a positive amount." };
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { booksOpeningDate: true, booksLockedUntil: true } });
  if (!branch?.booksOpeningDate) return { error: "Set up the books first." };
  const date = utcDay(branch.booksOpeningDate);
  if (isLocked(date, branch.booksLockedUntil ? utcDay(branch.booksLockedUntil) : null)) return { error: "The opening date is in a locked period." };
  const party = type === "CLIENT" ? await prisma.client.findUnique({ where: { id: partyId }, select: { branchId: true, name: true } }) : await prisma.supplier.findUnique({ where: { id: partyId }, select: { branchId: true, name: true } });
  if (!party || (party.branchId && party.branchId !== branchId)) return { error: "Not found." };
  const tag = type === "CLIENT" ? "RECEIVABLE" : "PAYABLE";
  const [control, equity] = await Promise.all([
    prisma.account.findFirst({ where: { branchId, tag }, select: { id: true } }),
    prisma.account.findFirst({ where: { branchId, tag: "OPENING_EQUITY" }, select: { id: true } }),
  ]);
  if (!control || !equity) return { error: "The control accounts are missing. Open Set-up first." };
  const sign = type === "CLIENT" ? 1 : -1; // net = debit − credit; a receivable is a debit, a payable a credit

  const existing = await prisma.journalEntry.findFirst({ where: { branchId, sourceKey: "opening" }, include: { lines: true } });
  type L = { accountId: string; debit: number; credit: number; partyType?: string; partyId?: string; description?: string | null };
  const lines: L[] = (existing?.lines ?? []).map((l) => ({ accountId: l.accountId, debit: Number(l.debit), credit: Number(l.credit), partyType: l.partyType ?? undefined, partyId: l.partyId ?? undefined, description: l.description }));
  const net = (ls: L[]) => r2(ls.reduce((n, l) => n + l.debit - l.credit, 0)) * sign;
  const onControl = lines.filter((l) => l.accountId === control.id);
  const before = net(onControl.filter((l) => l.partyId === partyId && l.partyType === type));
  const untagged = net(onControl.filter((l) => !l.partyId));
  const nextUntagged = Math.max(0, r2(untagged - (value - before)));
  const rest = lines.filter((l) => l.accountId !== control.id || (l.partyId && !(l.partyId === partyId && l.partyType === type)));
  const side = (n: number): Pick<L, "debit" | "credit"> => (n * sign > 0 ? { debit: Math.abs(n), credit: 0 } : { debit: 0, credit: Math.abs(n) });
  const next: L[] = [
    ...rest.filter((l) => l.accountId !== equity.id),
    ...(nextUntagged > 0 ? [{ accountId: control.id, ...side(nextUntagged * sign) }] : []),
    ...(value > 0 ? [{ accountId: control.id, partyType: type, partyId, ...side(value * sign) }] : []),
  ];
  const t = totals(next);
  const plug = r2(t.debit - t.credit);
  if (plug !== 0) next.push(plug > 0 ? { accountId: equity.id, debit: 0, credit: plug } : { accountId: equity.id, debit: -plug, credit: 0 });
  const data = next.map(({ accountId, debit, credit, partyType, partyId: pid, description }) => ({ accountId, debit, credit, partyType: partyType ?? null, partyId: pid ?? null, description: description ?? null }));

  await prisma.$transaction(async (tx) => {
    if (existing) await tx.journalLine.deleteMany({ where: { entryId: existing.id } });
    if (data.length === 0) { if (existing) await tx.journalEntry.delete({ where: { id: existing.id } }); return; }
    if (existing) {
      await tx.journalEntry.update({ where: { id: existing.id }, data: { date, narration: "Opening balances", status: "POSTED" } });
      await tx.journalLine.createMany({ data: data.map((l) => ({ entryId: existing.id, ...l })) });
    } else {
      const [number] = await reserveNumbers(branchId, "OB", 1);
      await tx.journalEntry.create({ data: { branchId, number, date, type: "OPENING", narration: "Opening balances", sourceKey: "opening", createdById: user.id, createdByName: user.name, lines: { create: data } } });
    }
  });
  await logAudit({ entityType: "BOOKS", entityId: partyId, action: "UPDATE", before: { opening: before }, after: { opening: value, party: party.name }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/finance/books", "layout");
  return {};
}

export type PartyEntryKind = "NOTE" | "MONEY";
export type PartyEntryInput = {
  type: "CLIENT" | "SUPPLIER";
  partyId: string;
  /** NOTE: a credit note (client) or debit note (supplier). MONEY: a receipt (client) or payment (supplier). */
  kind: PartyEntryKind;
  date: string;
  /** Before VAT for a note; the whole amount for money. */
  amount: number;
  vat?: number;
  narration: string;
  /** The bank or cash account the money moved through. */
  moneyAccountId?: string;
};

/**
 * Entries that change what a client owes or what is owed to a supplier outside the normal invoice and bill flow:
 * a credit note that reduces an invoice, a debit note that reduces a bill, a part payment or an advance.
 * Invoices marked paid and bill payments already post by themselves, so these are for the cases they don't cover.
 */
export async function createPartyEntryAction(input: PartyEntryInput): Promise<Result & { number?: string }> {
  await requireWrite("finance.books");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Choose a date." };
  const date = new Date(`${input.date}T00:00:00.000Z`);
  const amount = r2(Number(input.amount) || 0);
  const vat = input.kind === "NOTE" ? r2(Number(input.vat) || 0) : 0;
  if (amount <= 0) return { error: "Enter an amount." };
  if (vat < 0) return { error: "VAT can't be negative." };
  const narration = input.narration.trim();
  if (!narration) return { error: "Say what it is for." };
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { booksOpeningDate: true, booksLockedUntil: true } });
  if (!branch?.booksOpeningDate) return { error: "Set up the books first." };
  if (date.getTime() < utcDay(branch.booksOpeningDate).getTime()) return { error: "That is before your books start. Earlier figures belong in the opening balances." };
  if (isLocked(date, branch.booksLockedUntil ? utcDay(branch.booksLockedUntil) : null)) return { error: "That period is locked." };
  const party = input.type === "CLIENT" ? await prisma.client.findUnique({ where: { id: input.partyId }, select: { branchId: true } }) : await prisma.supplier.findUnique({ where: { id: input.partyId }, select: { branchId: true } });
  if (!party || party.branchId !== branchId) return { error: "Not found." };

  const client = input.type === "CLIENT";
  const tags = client ? ["RECEIVABLE", "INCOME_SALES", "VAT_OUTPUT"] : ["PAYABLE", "COST_SUPPLIERS", "VAT_INPUT"];
  const accounts = await prisma.account.findMany({ where: { branchId, tag: { in: tags } }, select: { id: true, tag: true } });
  const by = (t: string) => accounts.find((a) => a.tag === t)?.id;
  const control = by(tags[0]);
  if (!control) return { error: "The Receivable / Payable account is missing. Open Set-up first." };
  const partyRef = { partyType: input.type, partyId: input.partyId };
  type L = { accountId: string; debit: number; credit: number; partyType?: string; partyId?: string };
  let lines: L[];
  let type: string;
  if (input.kind === "NOTE") {
    const net = by(tags[1]), tax = by(tags[2]);
    if (!net || (vat > 0 && !tax)) return { error: "The income, cost or VAT account is missing. Open Set-up first." };
    const total = r2(amount + vat);
    // A credit note undoes a sale (less income, less VAT collected, less owed); a debit note undoes a purchase.
    lines = client
      ? [{ accountId: net, debit: amount, credit: 0 }, ...(vat > 0 ? [{ accountId: tax!, debit: vat, credit: 0 }] : []), { accountId: control, debit: 0, credit: total, ...partyRef }]
      : [{ accountId: control, debit: total, credit: 0, ...partyRef }, { accountId: net, debit: 0, credit: amount }, ...(vat > 0 ? [{ accountId: tax!, debit: 0, credit: vat }] : [])];
    type = client ? "CREDIT_NOTE" : "DEBIT_NOTE";
  } else {
    const money = input.moneyAccountId ? await prisma.account.findUnique({ where: { id: input.moneyAccountId }, select: { branchId: true, type: true, isActive: true } }) : null;
    if (!money || money.branchId !== branchId || money.type !== "ASSET" || !money.isActive) return { error: client ? "Choose where the money was paid in." : "Choose where the money was paid from." };
    lines = client
      ? [{ accountId: input.moneyAccountId!, debit: amount, credit: 0 }, { accountId: control, debit: 0, credit: amount, ...partyRef }]
      : [{ accountId: control, debit: amount, credit: 0, ...partyRef }, { accountId: input.moneyAccountId!, debit: 0, credit: amount }];
    type = client ? "RECEIPT" : "PAYMENT";
  }
  const prefix = VOUCHER_PREFIX[type];
  const [number] = await reserveNumbers(branchId, prefix, 1);
  const entry = await prisma.journalEntry.create({ data: { branchId, number, date, type, narration, createdById: user.id, createdByName: user.name, lines: { create: lines } } });
  await logAudit({ entityType: "JOURNAL_ENTRY", entityId: entry.id, action: "CREATE", after: { number, type, party: input.partyId, total: r2(amount + vat) }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/finance/books", "layout");
  return { number };
}
