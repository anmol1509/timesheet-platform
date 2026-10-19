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
