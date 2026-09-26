import { History } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { AuditLogList } from "./audit-log-list";
import { ExportDialog } from "./export-dialog";
import { entityMeta } from "@/lib/auditPresentation";

const MAX_ROWS = 500;

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function AuditLogPage() {
  const { branchId } = await requireUserWithBranch();
  const entries = await prisma.auditLog.findMany({
    where: branchWhere(branchId),
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  const startOfToday = startOfDay();
  const today = entries.filter((e) => e.createdAt >= startOfToday);
  const mode = <T,>(xs: T[]) => {
    const c = new Map<T, number>();
    for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const topUser = mode(today.map((e) => e.userName));
  const topModule = mode(today.map((e) => entityMeta(e.entityType).module));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Audit Log"
          icon={History}
          description={<>Who changed what, across every module. Showing the most recent {MAX_ROWS} entries.</>}
        />
        <ExportDialog />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { l: "Changes today", v: today.length, sub: `${new Set(today.map((e) => e.userName)).size} people` },
          { l: "Most active", v: topUser ?? "—", sub: topUser ? "today" : "no activity today" },
          { l: "Busiest area", v: topModule ?? "—", sub: "today" },
        ].map((t) => (
          <div key={t.l} className="card px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="truncate text-[11px] font-medium text-muted sm:text-xs">{t.l}</p>
            <p className="tabular mt-0.5 truncate text-base font-semibold tracking-tight text-primary sm:text-xl">{t.v}</p>
            <p className="hidden text-xs text-subtle sm:block">{t.sub}</p>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm text-muted">No audit entries yet.</p>
        </div>
      ) : (
        <AuditLogList
          now={new Date().toISOString()}
          entries={entries.map((e) => ({
            id: e.id,
            entityType: e.entityType,
            entityId: e.entityId,
            action: e.action,
            changes: e.changes as Record<string, unknown> | null,
            userName: e.userName,
            createdAt: e.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
