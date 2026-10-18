import { History } from "lucide-react";
import { HeroHeader, heroButton } from "@/components/HeroHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { auditNames } from "@/lib/auditNames";
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

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ entityType?: string; entityId?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const { entityType, entityId } = await searchParams;
  const canSeePay = can(subjectOf(user), "payroll", "view");
  const entries = await prisma.auditLog.findMany({
    where: { ...branchWhere(branchId), ...(entityType && entityId ? { entityType, entityId } : {}) },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  const names = await auditNames(entries);
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
      <HeroHeader
        icon={History}
        title="Audit log"
        subtitle={entityType && entityId ? "The history of one record: who changed what, in plain words." : `Who changed what, in plain words, across every module. Showing the most recent ${MAX_ROWS} entries.`}
        pills={[
          { label: "Changes today", value: String(today.length) },
          { label: "People active", value: String(new Set(today.map((e) => e.userName)).size) },
          { label: "Most active", value: topUser ?? "—" },
          { label: "Busiest area", value: topModule ?? "—" },
        ]}
        actions={<ExportDialog triggerClassName={heroButton(true)} />}
      />

      {entries.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm text-muted">No audit entries yet.</p>
        </div>
      ) : (
        <AuditLogList
          now={new Date().toISOString()}
          canSeePay={canSeePay}
          entries={entries.map((e) => ({
            id: e.id,
            entityType: e.entityType,
            entityId: e.entityId,
            action: e.action,
            changes: e.changes as Record<string, unknown> | null,
            userName: e.userName,
            name: names[e.id] ?? null,
            createdAt: e.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
