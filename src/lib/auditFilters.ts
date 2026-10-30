import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { branchWhere } from "@/lib/branch";
import { ENTITY_META } from "@/lib/auditPresentation";

import type { AuditQuery } from "@/lib/auditQuery";
export { auditQueryString, describeAuditQuery, parseAuditQuery, type AuditQuery } from "@/lib/auditQuery";

/** Entity types that belong to an area, or null for "Other" handled by exclusion. */
const typesOfModule = (m: string) => Object.entries(ENTITY_META).filter(([, v]) => v.module === m).map(([k]) => k);

export async function auditWhere(q: AuditQuery, branchId: string | null): Promise<Prisma.AuditLogWhereInput> {
  const and: Prisma.AuditLogWhereInput[] = [branchWhere(branchId)];
  if (q.user) and.push({ userId: q.user });
  if (q.action) and.push({ action: q.action });
  if (q.entityType) and.push({ entityType: q.entityType });
  if (q.entityId) and.push({ entityId: q.entityId });
  if (q.source) and.push(q.source === "SCREEN" ? { OR: [{ source: "SCREEN" }, { source: null }] } : { source: q.source });
  if (q.batch) and.push({ batchId: q.batch });
  if (q.module) {
    const types = typesOfModule(q.module);
    and.push(q.module === "Other" ? { entityType: { notIn: Object.keys(ENTITY_META) } } : { entityType: { in: types } });
  }
  if (q.from || q.to) {
    and.push({ createdAt: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00+04:00`) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999+04:00`) } : {}) } });
  }
  if (q.q) {
    // The words can be in who did it, the bulk action's name, the record's reference, or the changed values themselves.
    const like = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const hits = branchId
      ? await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "AuditLog" WHERE "branchId" = ${branchId} AND (changes::text ILIKE ${like} OR "userName" ILIKE ${like} OR "batchLabel" ILIKE ${like} OR "entityId" = ${q.q}) ORDER BY "createdAt" DESC LIMIT 5000`
      : await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "AuditLog" WHERE (changes::text ILIKE ${like} OR "userName" ILIKE ${like} OR "batchLabel" ILIKE ${like} OR "entityId" = ${q.q}) ORDER BY "createdAt" DESC LIMIT 5000`;
    and.push({ id: { in: hits.map((h) => h.id) } });
  }
  return { AND: and };
}

