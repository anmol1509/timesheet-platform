import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { Badge } from "@/components/Badge";
import { TicketReply } from "./ticket-reply";

export const metadata = { title: "Supplier message" };
const when = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function SupplierTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const t = await prisma.supplierTicket.findUnique({ where: { id }, include: { supplier: { select: { name: true } }, messages: { orderBy: { createdAt: "asc" } } } });
  if (!t || isOutsideBranch(t.branchId, branchId, isSuperAdmin)) notFound();
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/suppliers/tickets" className="text-xs text-muted hover:text-secondary">← Supplier messages</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-primary">{t.subject}</h1>
          <Badge color={t.status === "OPEN" ? "amber" : t.status === "REPLIED" ? "green" : "slate"} dot>{t.status === "OPEN" ? "Needs a reply" : t.status === "REPLIED" ? "Replied" : "Closed"}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">{t.supplier.name} · {t.kind === "COMPLAINT" ? "Complaint" : "Feedback"}</p>
      </div>
      <ul className="space-y-3">
        {t.messages.map((m) => (
          <li key={m.id} className={`card p-4 text-sm ${m.fromSupplier ? "" : "border-[var(--brand-primary)]/30 bg-brand-soft"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-medium text-primary">{m.fromSupplier ? `${t.supplier.name} (${m.authorName})` : `${m.authorName} (our team)`}</span><span className="text-xs text-subtle">{when(m.createdAt)}</span></div>
            <p className="mt-1.5 whitespace-pre-wrap text-secondary">{m.body}</p>
          </li>
        ))}
      </ul>
      <TicketReply ticketId={t.id} status={t.status} canReply={can(subjectOf(user), "partners", "edit")} />
    </div>
  );
}
