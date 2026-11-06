import { prisma } from "@/lib/db";
export { effectiveLicenceExpiry } from "@/lib/licenceExpiry";

/**
 * A supplier's trade licence expiry, from the licence file as well as the supplier's own field.
 *
 * The date typed on the supplier and the one on an uploaded Trade licence file were kept separately, so renewing the
 * licence by uploading the new file left the supplier still showing the old date, and Renewals kept calling the
 * licence expired. The later of the two is the one that is true: a renewed file is later than the old field, and a
 * date typed in ahead of the file is later than an old file.
 */
export async function licenceFileExpiries(supplierIds: string[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (supplierIds.length === 0) return out;
  const rows = await prisma.attachment.groupBy({
    by: ["entityId"],
    where: { entityType: "SUPPLIER", docType: "TRADE_LICENSE", entityId: { in: supplierIds }, expiryDate: { not: null } },
    _max: { expiryDate: true },
  });
  for (const r of rows) if (r._max.expiryDate) out.set(r.entityId, r._max.expiryDate);
  return out;
}
