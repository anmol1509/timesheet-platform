import { FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { getEssEmployee } from "@/lib/ess/session";
import { Badge, type BadgeColor } from "@/components/Badge";

export const metadata = { title: "My documents" };

export default async function EssDocumentsPage() {
  const employee = (await getEssEmployee())!;
  const docs = await prisma.document.findMany({
    where: { employeeId: employee.id, displayInEss: true },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, type: true, filename: true, expiryDate: true },
  });
  const now = new Date().getTime();
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-primary">Documents</h1>
      <p className="-mt-3 text-sm text-muted">Documents your office has shared with you.</p>
      {docs.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">Nothing shared yet.</div>
      ) : (
        <ul className="card divide-y divide-[var(--border)]">
          {docs.map((d) => {
            const days = d.expiryDate ? Math.ceil((d.expiryDate.getTime() - now) / 86_400_000) : null;
            const color: BadgeColor = days === null ? "slate" : days < 0 ? "red" : days <= 30 ? "amber" : "green";
            return (
              <li key={d.id}>
                <a href={`/me/documents/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover">
                  <FileText className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-primary">{d.type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>
                    <span className="block truncate text-xs text-muted">{d.filename}</span>
                  </span>
                  {days !== null && <Badge color={color}>{days < 0 ? "Expired" : `${days}d left`}</Badge>}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
