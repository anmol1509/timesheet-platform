import { prisma } from "@/lib/db";
import type { Db } from "@/lib/importer/types";
import { CLIENT_PREFIX, codeCandidates, nameKey, pickCode } from "@/lib/partyCode";

/** The name's code, with more letters (and as a last resort a number) if the branch already uses it. */
export async function uniqueSupplierCode(name: string, branchId: string, excludeId?: string, db: Db = prisma) {
  const rows = await db.supplier.findMany({
    where: { branchId, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { code: true },
  });
  return pickCode(name, new Set(rows.map((r) => r.code)));
}

export async function uniqueClientCode(name: string, branchId: string, excludeId?: string, db: Db = prisma) {
  const candidates = codeCandidates(name, CLIENT_PREFIX);
  const rows = await db.client.findMany({
    where: { branchId, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { code: true },
  });
  const taken = new Set(rows.map((r) => r.code));
  const free = candidates.find((c) => !taken.has(c));
  if (free) return free;
  const base = candidates[candidates.length - 1];
  for (let n = 2; ; n++) {
    if (!taken.has(`${base}${n}`)) return `${base}${n}`;
  }
}

/** A supplier of this branch with the same name, ignoring case, dots and spacing
 * ("Top Peak Cont." and "TOP PEAK CONT" are one company). */
export async function findSupplierByName(name: string, branchId: string, db: Db = prisma) {
  const key = nameKey(name);
  const rows = await db.supplier.findMany({ where: { branchId } });
  return rows.find((r) => nameKey(r.name) === key) ?? null;
}

export async function findClientByName(name: string, branchId: string, db: Db = prisma) {
  const key = nameKey(name);
  const rows = await db.client.findMany({ where: { branchId } });
  return rows.find((r) => nameKey(r.name) === key) ?? null;
}
