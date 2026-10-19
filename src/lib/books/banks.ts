import { prisma } from "@/lib/db";
import { bankLedgerName } from "./sync";

export type BankOption = { id: string; label: string };

/** The company's switched-on bank accounts, named the way the books name them. */
export async function listBanks(branchId: string | null): Promise<BankOption[]> {
  if (!branchId) return [];
  const banks = await prisma.bank.findMany({ where: { branchId, status: { not: "INACTIVE" } }, orderBy: [{ bankName: "asc" }, { accountName: "asc" }] });
  return banks.map((b) => ({ id: b.id, label: bankLedgerName(b) }));
}

/** A bank id from a form, only if it is one of this branch's banks. */
export async function ownBankId(raw: unknown, branchId: string | null): Promise<string | null> {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id || !branchId) return null;
  const b = await prisma.bank.findFirst({ where: { id, branchId }, select: { id: true } });
  return b?.id ?? null;
}

/** Ledger accounts that stand for a foreign-currency bank account, with the currency and the latest rate on file. */
export async function foreignAccounts(branchId: string | null): Promise<Record<string, { currency: string; rate: number | null }>> {
  if (!branchId) return {};
  const accounts = await prisma.account.findMany({ where: { branchId, bank: { is: { currency: { not: "AED" } } } }, select: { id: true, bank: { select: { currency: true } } } });
  if (!accounts.length) return {};
  const rates = await prisma.exchangeRate.findMany({ where: { branchId }, orderBy: { date: "desc" } });
  const out: Record<string, { currency: string; rate: number | null }> = {};
  for (const a of accounts) {
    const cur = (a.bank?.currency ?? "").toUpperCase();
    const latest = rates.find((r) => r.currency === cur);
    out[a.id] = { currency: cur, rate: latest ? Number(latest.rate) : null };
  }
  return out;
}
