import { prisma } from "@/lib/db";
import { acronymFor } from "@/lib/partyCode";

// Supplier and client codes are "PREFIX + zero-padded sequence" and unique
// within a branch. The next one is the highest number already used in that
// branch plus one — counting rows would reuse a number after a delete and
// would let another company's records shift this one's numbering.
async function nextCode(prefix: string, codes: (string | null)[]) {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const c of codes) {
    const m = c ? re.exec(c) : null;
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** The acronym of `name`, with a number added if the branch already uses it. */
export async function uniqueSupplierCode(name: string, branchId: string, excludeId?: string) {
  const base = acronymFor(name);
  const rows = await prisma.supplier.findMany({
    where: { branchId, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { code: true },
  });
  const taken = new Set(rows.map((r) => r.code));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base}${n}`)) return `${base}${n}`;
  }
}

export async function nextClientCode(branchId: string) {
  const rows = await prisma.client.findMany({ where: { branchId }, select: { code: true } });
  return nextCode("CLI", rows.map((r) => r.code));
}
