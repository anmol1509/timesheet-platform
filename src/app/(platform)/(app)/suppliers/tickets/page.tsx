import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { PageHeader } from "@/components/PageHeader";
import { Badge, type BadgeColor } from "@/components/Badge";

export const metadata = { title: "Supplier messages" };
const STATUS: Record<string, { label: string; color: BadgeColor }> = { OPEN: { label: "Needs a reply", color: "amber" }, REPLIED: { label: "Replied", color: "green" }, CLOSED: { label: "Closed", color: "slate" } };
const FILTERS = [{ k: "", l: "All" }, { k: "OPEN", l: "Needs a reply" }, { k: "REPLIED", l: "Replied" }, { k: "CLOSED", l: "Closed" }];
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** Feedback and complaints suppliers have sent from their portal. */
export default async function SupplierTicketsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { branchId } = await requireUserWithBranch();
  const { status = "" } = await searchParams;
  const tickets = await prisma.supplierTicket.findMany({
    where: { ...branchWhere(branchId), ...(FILTERS.some((f) => f.k && f.k === status) ? { status } : {}) },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
    include: { supplier: { select: { name: true } }, _count: { select: { messages: true } } },
  });
  const open = await prisma.supplierTicket.count({ where: { ...branchWhere(branchId), status: "OPEN" } });
  return (
    <div className="space-y-5">
      <PageHeader title="Supplier messages" description="Feedback and complaints from suppliers. Reply here and they see it in their portal." />
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <Link key={f.k || "all"} href={f.k ? `/suppliers/tickets?status=${f.k}` : "/suppliers/tickets"} role="tab" aria-selected={status === f.k}
            className={status === f.k ? "rounded-md bg-brand-soft px-3 py-1.5 text-sm font-medium text-[var(--brand-primary)]" : "rounded-md px-3 py-1.5 text-sm text-secondary hover:bg-surface-hover"}>
            {f.l}{f.k === "OPEN" && open > 0 && <span className="ml-1.5 rounded-full bg-[var(--warning-soft)] px-1.5 text-xs text-[var(--warning)]">{open}</span>}
          </Link>
        ))}
      </div>
      {tickets.length === 0 ? <div className="empty-state"><p className="text-sm text-muted">No messages here.</p></div> : (
        <ul className="card divide-y divide-[var(--border)] overflow-hidden">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/suppliers/tickets/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm transition hover:bg-surface-hover">
                <span className="min-w-0">
                  <span className="font-medium text-primary">{t.subject}</span>
                  <span className="block text-xs text-muted">{t.supplier.name} · {t.kind === "COMPLAINT" ? "Complaint" : "Feedback"} · {t._count.messages} message{t._count.messages === 1 ? "" : "s"} · {day(t.updatedAt)}</span>
                </span>
                <Badge color={STATUS[t.status]?.color ?? "slate"} dot>{STATUS[t.status]?.label ?? t.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
