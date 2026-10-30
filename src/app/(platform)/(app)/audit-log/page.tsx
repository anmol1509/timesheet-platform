import { History } from "lucide-react";
import { HeroHeader, heroButton } from "@/components/HeroHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can, canRecover } from "@/lib/permissions";
import { auditNames } from "@/lib/auditNames";
import { branchWhere } from "@/lib/branch";
import { AuditLogList } from "./audit-log-list";
import { ExportDialog } from "./export-dialog";
import { ENTITY_META, entityMeta } from "@/lib/auditPresentation";
import { auditWhere, parseAuditQuery } from "@/lib/auditFilters";
import { REVERTIBLE } from "@/lib/auditRevertPlan";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

/** Midnight at the start of today in UAE time. */
function startOfUaeToday() {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${ymd}T00:00:00+04:00`);
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, branchId } = await requireUserWithBranch();
  const sp = await searchParams;
  const query = parseAuditQuery(sp);
  const pageNo = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const canSeePay = can(subjectOf(user), "payroll", "view");
  const canRevert = canRecover(subjectOf(user), "edit");

  const where = await auditWhere(query, branchId);
  const todayStart = startOfUaeToday();
  const [entries, total, todayRows, people] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (pageNo - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["userName", "entityType"], where: { ...branchWhere(branchId), createdAt: { gte: todayStart } }, _count: { _all: true } }),
    prisma.auditLog.groupBy({ by: ["userId", "userName"], where: branchWhere(branchId), _count: { _all: true }, orderBy: { _count: { userId: "desc" } }, take: 100 }),
  ]);

  const names = await auditNames(entries);
  const todayCount = todayRows.reduce((n, r) => n + r._count._all, 0);
  const tally = <T,>(pick: (r: (typeof todayRows)[number]) => T) => {
    const c = new Map<T, number>();
    for (const r of todayRows) c.set(pick(r), (c.get(pick(r)) ?? 0) + r._count._all);
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const topUser = tally((r) => r.userName);
  const topModule = tally((r) => entityMeta(r.entityType).module);
  const filtered = Object.keys(query).length > 0;

  return (
    <div className="space-y-5">
      <HeroHeader
        icon={History}
        title="Audit log"
        subtitle={query.entityType && query.entityId ? "The history of one record: who changed what, in plain words." : "Who changed what, in plain words, across every module. Filter by person, area, date or words, then export to Excel."}
        pills={[
          { label: "Changes today", value: String(todayCount) },
          { label: "People active", value: String(new Set(todayRows.map((r) => r.userName)).size) },
          { label: "Most active", value: topUser ?? "—" },
          { label: "Busiest area", value: topModule ?? "—" },
        ]}
        actions={<ExportDialog triggerClassName={heroButton(true)} query={query} total={total} />}
      />

      <AuditLogList
        canSeePay={canSeePay}
        canRevert={canRevert}
        revertTypes={Object.keys(REVERTIBLE)}
        query={query}
        page={pageNo}
        pageSize={PAGE_SIZE}
        total={total}
        filtered={filtered}
        users={people.map((p) => ({ id: p.userId, name: p.userName }))}
        modules={[...new Set([...Object.values(ENTITY_META).map((m) => m.module), "Other"])].sort()}
        entries={entries.map((e) => ({
          id: e.id,
          entityType: e.entityType,
          entityId: e.entityId,
          action: e.action,
          changes: e.changes as Record<string, unknown> | null,
          userName: e.userName,
          name: names[e.id] ?? null,
          createdAt: e.createdAt.toISOString(),
          source: e.source,
          batchId: e.batchId,
          batchLabel: e.batchLabel,
          revertOfId: e.revertOfId,
          revertedAt: e.revertedAt?.toISOString() ?? null,
          revertedByName: e.revertedByName,
        }))}
      />
    </div>
  );
}
