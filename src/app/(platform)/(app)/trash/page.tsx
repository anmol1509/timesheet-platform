import { canRecover } from "@/lib/permissions";
import { Trash2 } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { purgeExpired, TRASH_DAYS } from "@/lib/trash";
import { TrashList } from "./trash-list";

export const metadata = { title: "Recently deleted" };

export default async function TrashPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const { q } = await searchParams;
  if (!canRecover(subjectOf(user), "view")) {
    return <div className="empty-state"><p className="text-sm text-muted">You don't have access to recently deleted records. Ask an administrator to give your role “Recently deleted & put-back”.</p></div>;
  }
  await purgeExpired();
  const where = { ...branchWhere(branchId), ...(q ? { label: { contains: q, mode: "insensitive" as const } } : {}) };
  const [live, restored] = await Promise.all([
    prisma.deletedRecord.findMany({ where: { ...where, restoredAt: null }, orderBy: { deletedAt: "desc" }, take: 300, select: { id: true, kind: true, label: true, detail: true, deletedByName: true, deletedAt: true, expiresAt: true, sizeBytes: true } }),
    prisma.deletedRecord.findMany({ where: { ...where, restoredAt: { not: null } }, orderBy: { restoredAt: "desc" }, take: 10, select: { id: true, kind: true, label: true, restoredAt: true, restoredByName: true } }),
  ]);

  return (
    <div className="space-y-5">
      <HeroHeader
        icon={Trash2}
        title="Recently deleted"
        subtitle={`Workers, worker documents and attached files you delete are kept here for ${TRASH_DAYS} days, so a wrong delete can be put right.`}
        pills={[{ label: "Waiting here", value: String(live.length) }, { label: "Kept for", value: `${TRASH_DAYS} days` }]}
      />
      <TrashList
        q={q ?? ""}
        items={live.map((r) => ({ id: r.id, kind: r.kind, label: r.label, detail: r.detail, deletedByName: r.deletedByName, deletedAt: r.deletedAt.toISOString(), daysLeft: Math.max(0, Math.ceil((r.expiresAt.getTime() - Date.now()) / 86_400_000)), sizeKb: Math.round(r.sizeBytes / 1024) }))}
        restored={restored.map((r) => ({ id: r.id, kind: r.kind, label: r.label, restoredAt: r.restoredAt!.toISOString(), restoredByName: r.restoredByName }))}
      />
    </div>
  );
}
