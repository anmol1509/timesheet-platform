import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { MarkAllRead } from "./mark-all-read";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((i) => !i.readAt).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">Notifications</h1>
          <p className="mt-1 text-sm text-muted">{unread > 0 ? `${unread} unread.` : "You're all caught up."} Delivery preferences are on your profile.</p>
        </div>
        {unread > 0 && <MarkAllRead />}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Expense approvals and expiry digests will show up here." />
      ) : (
        <ul className="card divide-y divide-[var(--border)]">
          {items.map((n) => {
            const inner = (
              <div className="flex items-start gap-3 px-4 py-3">
                <span className={n.readAt ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent" : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--brand-primary)]"} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={n.readAt ? "text-sm text-secondary" : "text-sm font-medium text-primary"}>{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                </div>
                <time className="shrink-0 text-xs text-muted" dateTime={n.createdAt.toISOString()}>
                  {n.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </time>
              </div>
            );
            return <li key={n.id}>{n.href ? <Link href={n.href} className="block hover:bg-surface-hover">{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
