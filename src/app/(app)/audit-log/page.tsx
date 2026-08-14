import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { AuditLogList } from "./audit-log-list";

const MAX_ROWS = 500;

export default async function AuditLogPage() {
  const { branchId } = await requireUserWithBranch();
  const entries = await prisma.auditLog.findMany({
    where: branchWhere(branchId),
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">Audit Log</h1>
        <p className="mt-1 text-sm text-muted">
          Who changed what, across every module. Showing the most recent {MAX_ROWS} entries.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm text-muted">No audit entries yet.</p>
        </div>
      ) : (
        <AuditLogList
          entries={entries.map((e) => ({
            id: e.id,
            entityType: e.entityType,
            entityId: e.entityId,
            action: e.action,
            changes: e.changes as Record<string, unknown> | null,
            userName: e.userName,
            createdAt: e.createdAt,
          }))}
        />
      )}
    </div>
  );
}
