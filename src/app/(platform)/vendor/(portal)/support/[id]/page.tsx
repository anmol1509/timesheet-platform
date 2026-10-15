import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { Badge, type BadgeColor } from "@/components/Badge";
import { ReplyForm } from "./reply-form";

export const metadata = { title: "Message" };
const STATUS: Record<string, { label: string; color: BadgeColor }> = { OPEN: { label: "Awaiting our reply", color: "amber" }, REPLIED: { label: "We replied", color: "green" }, CLOSED: { label: "Closed", color: "slate" } };
const when = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function VendorTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendor = (await getVendor())!;
  const t = await prisma.supplierTicket.findFirst({ where: { id, supplierId: vendor.id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!t) notFound();
  return (
    <>
      <div>
        <Link href="/vendor/support" className="text-xs text-muted hover:text-secondary">← Support</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-primary">{t.subject}</h1>
          <Badge color={STATUS[t.status]?.color ?? "slate"} dot>{STATUS[t.status]?.label ?? t.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">{t.kind === "COMPLAINT" ? "Complaint" : "Feedback"}</p>
      </div>
      <ul className="space-y-3">
        {t.messages.map((m) => (
          <li key={m.id} className={`card p-4 text-sm ${m.fromSupplier ? "" : "border-[var(--brand-primary)]/30 bg-brand-soft"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-medium text-primary">{m.fromSupplier ? "You" : m.authorName}</span><span className="text-xs text-subtle">{when(m.createdAt)}</span></div>
            <p className="mt-1.5 whitespace-pre-wrap text-secondary">{m.body}</p>
          </li>
        ))}
      </ul>
      {t.status === "CLOSED" ? <p className="text-sm text-muted">This conversation is closed. Send a new message from Support if you need more help.</p> : <ReplyForm ticketId={t.id} />}
    </>
  );
}
