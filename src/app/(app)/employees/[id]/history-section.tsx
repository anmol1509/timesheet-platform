import Link from "next/link";
import { prisma } from "@/lib/db";
import { auditSentence } from "@/lib/auditSentence";

const SHOW = 12;

/** The last changes made to this worker's record, in plain words. Pay figures only appear for people who can see pay. */
export async function HistorySection({ employeeId, employeeName, canSeePay }: { employeeId: string; employeeName: string; canSeePay: boolean }) {
  const rows = await prisma.auditLog.findMany({ where: { entityType: "EMPLOYEE", entityId: employeeId }, orderBy: { createdAt: "desc" }, take: SHOW + 1 });
  const shown = rows.slice(0, SHOW);
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">Change history</h2>
        <Link href={`/audit-log?entityType=EMPLOYEE&entityId=${employeeId}`} className="text-xs text-[var(--brand-primary)] hover:underline">Open in audit log</Link>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">No changes recorded for this worker yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] text-sm">
          {shown.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-2">
              <p className="min-w-0 text-primary"><span className="font-medium">{e.userName}</span> {auditSentence({ entityType: e.entityType, action: e.action, changes: e.changes as Record<string, unknown> | null }, employeeName, { canSeePay })}</p>
              <time className="shrink-0 text-xs text-muted" dateTime={e.createdAt.toISOString()}>{e.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
            </li>
          ))}
        </ul>
      )}
      {rows.length > SHOW && <p className="mt-2 text-xs text-muted">Showing the latest {SHOW}.</p>}
    </section>
  );
}
