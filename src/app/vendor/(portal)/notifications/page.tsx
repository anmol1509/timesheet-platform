import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { markAllReadAction } from "./actions";

export const metadata = { title: "Notifications" };
const when = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function VendorNotificationsPage() {
  const vendor = (await getVendor())!;
  const items = await prisma.supplierNotification.findMany({ where: { supplierId: vendor.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">Notifications</h1>
          <p className="mt-1 text-sm text-muted">{unread > 0 ? `${unread} unread` : "You're all caught up."}</p>
        </div>
        {unread > 0 && <form action={markAllReadAction}><button type="submit" className="btn btn-secondary">Mark all as read</button></form>}
      </div>
      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted"><Bell className="mx-auto mb-2 h-5 w-5 text-subtle" aria-hidden />Nothing yet. We&apos;ll tell you here when there&apos;s a new request, a decision on an invoice, or a reply.</div>
      ) : (
        <ul className="card divide-y divide-[var(--border)] overflow-hidden">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={`/vendor/notifications/${n.id}`} className={`flex items-start gap-3 px-5 py-3 transition hover:bg-surface-hover ${n.readAt ? "" : "bg-brand-soft"}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-[var(--brand-primary)]"}`} aria-hidden />
                <span className="min-w-0 flex-1"><span className={`block text-sm ${n.readAt ? "text-secondary" : "font-medium text-primary"}`}>{n.title}</span>{n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}<span className="block text-xs text-subtle">{when(n.createdAt)}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
