import { CalendarClock } from "lucide-react";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can, canWrite } from "@/lib/permissions";
import { getRenewals, summarise } from "@/lib/renewals";
import { renewalKey, type RenewalRow, type RenewalStatus } from "@/lib/renewalCases";
import { RenewalsBoard } from "./renewals-board";

export const metadata = { title: "Renewals" };

export default async function RenewalsPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const items = await getRenewals(branchId);
  const counts = summarise(items);

  // The workflow state of each renewal (who has it, how far it has got), if anyone has touched it.
  const cases = items.length
    ? await prisma.renewalCase.findMany({
        where: { OR: items.map((i) => ({ kind: i.kind, subjectId: i.subjectId, document: i.document, expiry: new Date(`${i.expiry.slice(0, 10)}T00:00:00Z`) })) },
        include: { owner: { select: { name: true } } },
      })
    : [];
  const caseOf = new Map(cases.map((c) => [renewalKey({ kind: c.kind as "employee" | "supplier", subjectId: c.subjectId, document: c.document, expiry: c.expiry.toISOString() }), c]));
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const rows: RenewalRow[] = items.map((i) => {
    const key = renewalKey(i);
    const c = caseOf.get(key);
    return { ...i, key, status: (c?.status ?? "NOT_STARTED") as RenewalStatus, ownerId: c?.ownerId ?? null, ownerName: c?.owner?.name ?? null, note: c?.note ?? null, recent: !!c && c.updatedAt > weekAgo };
  });
  const owners = await prisma.user.findMany({
    where: { isActive: true, ...(branchId ? { OR: [{ branchId }, { role: "SUPER_ADMIN" as const }] } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Renewals"
        icon={CalendarClock}
        breadcrumbs={[{ label: "Workforce", href: "/employees" }, { label: "Renewals" }]}
        meta={<CountPill>{items.length}</CountPill>}
        description="Visas, labour cards, passports, Emirates IDs, medicals, and suppliers' trade licences and workmen's compensation falling due in the next 90 days — worst first, so long-lead renewals start in time."
      />
      <RenewalsBoard items={rows} counts={counts} owners={owners} currentUserId={user.id} canEdit={canWrite(subject, "workforce.renewals")} canExport={can(subject, "workforce.renewals", "export")} />
    </div>
  );
}
