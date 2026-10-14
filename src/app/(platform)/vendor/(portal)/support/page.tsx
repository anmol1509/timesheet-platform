import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { Badge, type BadgeColor } from "@/components/Badge";
import { NewTicketForm } from "./new-ticket-form";

export const metadata = { title: "Support" };
const STATUS: Record<string, { label: string; color: BadgeColor }> = { OPEN: { label: "Awaiting our reply", color: "amber" }, REPLIED: { label: "We replied", color: "green" }, CLOSED: { label: "Closed", color: "slate" } };
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default async function VendorSupportPage() {
  const vendor = (await getVendor())!;
  const [tickets, contacts] = await Promise.all([
    prisma.supplierTicket.findMany({ where: { supplierId: vendor.id }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.portalContact.findMany({ where: { branchId: vendor.branchId, isActive: true }, orderBy: [{ sortOrder: "asc" }, { department: "asc" }] }),
  ]);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Support</h1>
        <p className="mt-1 text-sm text-muted">Send us feedback or a complaint, and follow our reply here. For anything urgent, call us directly.</p>
      </div>

      {contacts.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-sm font-semibold text-primary">Who to contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {contacts.map((c) => (
              <div key={c.id} className="card p-4">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">{c.department}</p>
                <p className="mt-1 text-sm font-medium text-primary">{c.personName}{c.designation && <span className="font-normal text-muted"> · {c.designation}</span>}</p>
                <div className="mt-2 space-y-1 text-xs">
                  {c.phone && <p><a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 text-secondary hover:text-primary"><Phone className="h-3 w-3" aria-hidden />{c.phone}</a></p>}
                  {c.email && <p><a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-secondary hover:text-primary"><Mail className="h-3 w-3" aria-hidden />{c.email}</a></p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <NewTicketForm />

      <section className="card overflow-hidden">
        <div className="border-b border-default px-5 py-3"><h2 className="text-sm font-semibold text-primary">Your messages</h2></div>
        {tickets.length === 0 ? <p className="px-5 py-6 text-sm text-muted">You haven&apos;t sent us anything yet.</p> : (
          <ul className="divide-y divide-[var(--border)]">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/vendor/support/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition hover:bg-surface-hover">
                  <span className="min-w-0"><span className="font-medium text-primary">{t.subject}</span><span className="block text-xs text-muted">{t.kind === "COMPLAINT" ? "Complaint" : "Feedback"} · updated {day(t.updatedAt)}</span></span>
                  <Badge color={STATUS[t.status]?.color ?? "slate"} dot>{STATUS[t.status]?.label ?? t.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
