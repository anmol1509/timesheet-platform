import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { MarkAllRead } from "./mark-all-read";

export const metadata = { title: "Notifications" };

function dayLabel(d: Date, now: Date) {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((i) => !i.readAt).length;
  const now = new Date();
  const groups = new Map<string, typeof items>();
  for (const n of items) {
    const k = dayLabel(n.createdAt, now);
    groups.set(k, [...(groups.get(k) ?? []), n]);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Notifications"
          icon={Bell}
          description={<>{unread > 0 ? `${unread} unread.` : "You're all caught up."} Delivery preferences are on your profile.</>}
        />
        {unread > 0 && <MarkAllRead />}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Expense approvals and expiry digests will show up here." />
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([label, list]) => (
            <section key={label} aria-label={label}>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{label}</h2>
              <ul className="card divide-y divide-[var(--border)] overflow-hidden">
                {list.map((n) => {
                  const inner = (
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className={n.readAt ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent" : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--brand-primary)]"} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className={n.readAt ? "text-sm text-secondary" : "text-sm font-medium text-primary"}>{n.title}</p>
                        {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                      </div>
                      <time className="tabular shrink-0 text-xs text-muted" dateTime={n.createdAt.toISOString()}>
                        {n.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </time>
                    </div>
                  );
                  return <li key={n.id}>{n.href ? <Link href={n.href} className="block hover:bg-surface-hover">{inner}</Link> : inner}</li>;
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
