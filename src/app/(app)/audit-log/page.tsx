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

      <form action="/api/audit-log/export" method="get" className="card flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">From</span>
          <input type="date" name="from" className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">To</span>
          <input type="date" name="to" className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Action</span>
          <select name="action" className="input">
            <option value="">All</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Record type</span>
          <input name="entity" placeholder="e.g. EMPLOYEE" className="input" />
        </label>
        <button type="submit" className="btn btn-secondary">Export CSV</button>
        <p className="w-full text-xs text-muted">Exports up to 50,000 matching entries for the current branch view.</p>
      </form>

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
