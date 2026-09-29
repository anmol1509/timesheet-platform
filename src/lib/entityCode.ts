import { prisma } from "@/lib/db";
import { CLIENT_PREFIX, codeCandidates } from "@/lib/partyCode";

/** The name's code, with more letters (and as a last resort a number) if the branch already uses it. */
export async function uniqueSupplierCode(name: string, branchId: string, excludeId?: string) {
  const candidates = codeCandidates(name);
  const rows = await prisma.supplier.findMany({
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

export async function uniqueClientCode(name: string, branchId: string, excludeId?: string) {
  const candidates = codeCandidates(name, CLIENT_PREFIX);
  const rows = await prisma.client.findMany({
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
