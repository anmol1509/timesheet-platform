"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Bell, CheckCheck, ShieldCheck } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/(platform)/(app)/notifications/actions";
import { loadBellDecisionsAction, type BellDecision } from "@/app/(platform)/(app)/notifications/decisions";
import { decideApprovalAction } from "@/app/(platform)/(app)/approvals/actions";
import { COMPLIANCE_FIELDS } from "@/lib/compliance";
import type { ComplianceAlert } from "@/lib/dashboardAlerts";
import { cn } from "@/lib/cn";

import { Button } from "@/components/ui/Button";
/**
 * The bell. "For you" is what is waiting on this person (approvals they can
 * decide here, and unread messages), "Compliance" the documents running out, and
 * "Everything" the message history. Approvals are loaded when the bell opens, not
 * on every page.
 */
export type InboxItem = { id: string; title: string; body: string | null; href: string | null; read: boolean };

type Tab = "for-you" | "compliance" | "all";
// The documents the employee quick view can renew; the rest open the full profile.
const RENEWABLE = new Set(["visaExpiry", "laborCardExpiry", "medicalExpiry", "passportExpiry", "emiratesIdExpiry"]);
const fieldKey = (label: string) => COMPLIANCE_FIELDS.find((f) => f.label === label)?.key;
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
const KIND_CODE: Record<string, string> = { EXPENSE: "EX", BILL: "BL", PAYROLL: "PY", ADVANCE: "AD", WORKER: "NW", CHANGE: "CH", SUPPLIER: "SU", DEMAND: "DM", TIMESHEET: "TS", CORRECTION: "AT", DEPLOYMENT: "PA" };
const age = (d: number) => (d <= 0 ? "today" : d === 1 ? "1 day" : `${d} days`);
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Section({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pt-3 pb-1 text-[10.5px] font-semibold tracking-[0.06em] text-muted uppercase">{children}</p>;
}

function Urgency({ days }: { days: number }) {
  const [label, cls] = days >= 14 ? ["Overdue", "bg-[var(--error-soft)] text-[var(--error)]"] : days >= 7 ? ["Due soon", "bg-[var(--warning-soft)] text-[var(--warning)]"] : days >= 3 ? ["Waiting", "bg-[var(--info-soft)] text-[var(--info)]"] : ["New", "bg-surface-sunken text-muted"];
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", cls)}>{label}</span>;
}

export function NotificationsMenu({
  alerts,
  inbox = [],
  unreadCount = 0,
  pendingApprovals = 0,
}: {
  alerts: ComplianceAlert[];
  inbox?: InboxItem[];
  unreadCount?: number;
  pendingApprovals?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("for-you");
  const [decisions, setDecisions] = useState<{ items: BellDecision[]; total: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const overdue = alerts.filter((a) => a.days < 0);
  const soon = alerts.filter((a) => a.days >= 0);
  const unread = inbox.filter((n) => !n.read);
  const waiting = decisions ? decisions.total : pendingApprovals;
  const forYou = waiting + unreadCount;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setFailed(false);
    loadBellDecisionsAction().then(setDecisions).catch(() => setFailed(true));
  }

  async function approve(d: BellDecision) {
    setBusy(d.key);
    setErrors((e) => ({ ...e, [d.key]: "" }));
    const r = await decideApprovalAction({ kind: d.kind, id: d.id, ids: d.ids, field: d.field, decision: "APPROVE" }).catch(() => ({ error: "That didn't go through. Please try again." }));
    setBusy(null);
    if (r.error) return setErrors((e) => ({ ...e, [d.key]: r.error as string }));
    setDecisions((cur) => (cur ? { items: cur.items.filter((x) => x.key !== d.key), total: Math.max(0, cur.total - 1) } : cur));
    router.refresh();
  }

  const close = () => setOpen(false);
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "for-you", label: "For you", count: forYou },
    { id: "compliance", label: "Compliance", count: alerts.length },
    { id: "all", label: "Everything" },
  ];

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount + alerts.length + pendingApprovals > 0
              ? `Notifications: ${pendingApprovals} waiting for you, ${unreadCount} unread, ${alerts.length} compliance alerts`
              : "Notifications"
          }
          className="relative shrink-0 rounded-md p-2 text-muted transition hover:bg-surface-hover hover:text-primary"
        >
          <Bell className="h-4.5 w-4.5" />
          {(alerts.length > 0 || unreadCount > 0 || pendingApprovals > 0) && (
            <span
              className={cn(
                "absolute top-1 right-1 h-2 w-2 rounded-full ring-2 ring-[var(--surface)]",
                unreadCount > 0 || pendingApprovals > 0 ? "bg-[var(--brand-primary)]" : overdue.length > 0 ? "bg-[var(--error)]" : "bg-[var(--warning)]"
              )}
              aria-hidden
            />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="rx-popover z-50 w-[min(24.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-[20px] border border-default bg-surface shadow-popover"
        >
          <div className="flex items-center justify-between px-4 pt-3.5">
            <p className="text-[15px] font-semibold text-primary">
              Notifications{forYou > 0 && <span className="ml-2 rounded-full bg-[var(--info-soft)] px-2 py-0.5 align-middle text-[10.5px] font-semibold text-[var(--info)]">{forYou} need you</span>}
            </p>
            {unreadCount > 0 && (
              <button type="button" onClick={() => { void markAllNotificationsReadAction().then(() => router.refresh()); }} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline">
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />Mark all read
              </button>
            )}
          </div>
          <div role="tablist" aria-label="Notification groups" className="mt-2 flex gap-1 border-b border-default px-4">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={cn("-mb-px border-b-2 px-2.5 py-2 text-sm", tab === t.id ? "border-[var(--brand-primary)] font-semibold text-[var(--brand-primary)]" : "border-transparent text-muted hover:text-primary")}>
                {t.label}{!!t.count && <span className="tabular ml-1 text-xs opacity-80">{t.count}</span>}
              </button>
            ))}
          </div>

          <div className="max-h-[min(30rem,70vh)] overflow-y-auto px-2 pb-2" role="tabpanel">
            {tab === "for-you" && (
              <>
                {failed && <p className="px-2 py-3 text-xs text-[var(--error)]" role="alert">Couldn&apos;t load your approvals. Open the Approvals page instead.</p>}
                {!decisions && !failed && waiting > 0 && <div className="space-y-2 px-1 pt-3" aria-busy="true">{[0, 1].map((n) => <div key={n} className="h-[74px] animate-pulse rounded-[14px] bg-surface-sunken" />)}</div>}
                {decisions && decisions.items.length > 0 && (
                  <>
                    <Section>Needs a decision</Section>
                    {decisions.items.map((d) => (
                      <div key={d.key} className="mb-1.5 rounded-[14px] bg-surface-subtle p-2.5">
                        <div className="flex gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-brand-soft text-[11px] font-bold text-[var(--brand-primary)]">{KIND_CODE[d.kind] ?? "··"}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-primary">{d.title}</p>
                              <Urgency days={d.ageDays} />
                            </div>
                            <p className="truncate text-xs text-muted">{d.requester ?? d.subtitle}{d.amount !== null && ` · AED ${aed(d.amount)}`} · {age(d.ageDays)}</p>
                            {errors[d.key] && <p role="alert" className="mt-1 text-xs text-[var(--error)]">{errors[d.key]}</p>}
                            <div className="mt-2 flex gap-2">
                              <Link href={d.href} onClick={close} className="btn btn-secondary btn-sm">Review</Link>
                              {d.quickApprove && <Button size="btn-sm" type="button" disabled={busy === d.key} onClick={() => void approve(d)} loading={busy === d.key}>Approve</Button>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {decisions.total > decisions.items.length && <Link href="/approvals" onClick={close} className="block px-2 py-1.5 text-xs font-medium text-[var(--brand-primary)] hover:underline">See all {decisions.total} in Approvals</Link>}
                  </>
                )}
                {unread.length > 0 && (
                  <>
                    <Section>New</Section>
                    <MessageList items={unread} onNavigate={close} />
                  </>
                )}
                {decisions && decisions.items.length === 0 && unread.length === 0 && !failed && (
                  <div className="flex flex-col items-center px-4 py-8 text-center">
                    <ShieldCheck className="mb-2 h-5 w-5 text-[var(--success)]" aria-hidden />
                    <p className="text-sm font-medium text-primary">You&apos;re all caught up</p>
                    <p className="mt-1 text-xs text-muted">Nothing is waiting on you.</p>
                  </div>
                )}
              </>
            )}

            {tab === "compliance" && (
              alerts.length === 0 ? (
                <div className="flex flex-col items-center px-4 py-8 text-center">
                  <ShieldCheck className="mb-2 h-5 w-5 text-[var(--success)]" aria-hidden />
                  <p className="text-sm font-medium text-primary">All documents current</p>
                  <p className="mt-1 text-xs text-muted">Nothing expires in the next 30 days.</p>
                </div>
              ) : (
                <>
                  <p className="px-2 pt-3 pb-1 text-xs text-muted">
                    {overdue.length > 0 && <span className="font-medium text-[var(--error)]">{overdue.length} expired</span>}
                    {overdue.length > 0 && soon.length > 0 && " · "}
                    {soon.length > 0 && `${soon.length} due soon`}
                  </p>
                  <ul>
                    {alerts.slice(0, 12).map((a) => {
                      const key = fieldKey(a.field);
                      const renew = key && RENEWABLE.has(key);
                      return (
                        <li key={`${a.employeeId}-${a.field}`} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-surface-hover">
                          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[11px] font-bold", a.days < 0 ? "bg-[var(--error-soft)] text-[var(--error)]" : "bg-[var(--warning-soft)] text-[var(--warning)]")}>{initials(a.name)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-primary">{a.name}</span>
                            <span className={cn("block truncate text-xs", a.days < 0 ? "text-[var(--error)]" : "text-[var(--warning)]")}>
                              {a.field} {a.days < 0 ? `expired ${Math.abs(a.days)}d ago` : a.days === 0 ? "expires today" : `expires in ${a.days}d`}
                            </span>
                          </span>
                          <Link onClick={close} href={renew ? `/employees?open=${a.employeeId}&tab=documents&renew=${key}` : `/employees/${a.employeeId}`} className="btn btn-secondary btn-sm shrink-0">{renew ? "Renew" : "Open"}</Link>
                        </li>
                      );
                    })}
                  </ul>
                  {alerts.length > 12 && <Link href="/employees/renewals" onClick={close} className="block px-2 py-1.5 text-xs font-medium text-[var(--brand-primary)] hover:underline">View all {alerts.length} on Renewals</Link>}
                </>
              )
            )}

            {tab === "all" && (
              inbox.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No notifications yet.</p>
              ) : (
                <div className="pt-2"><MessageList items={inbox} onNavigate={close} /></div>
              )
            )}
          </div>

          <div className="flex items-center justify-between border-t border-default px-4 py-2.5 text-xs">
            <Link href="/profile" onClick={close} className="text-muted hover:text-primary">Notification settings</Link>
            <Link href="/notifications" onClick={close} className="font-medium text-[var(--brand-primary)] hover:underline">View all</Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function MessageList({ items, onNavigate }: { items: InboxItem[]; onNavigate: () => void }) {
  return (
    <ul>
      {items.map((n) => (
        <li key={n.id}>
          <Link
            href={n.href ?? "/notifications"}
            onClick={() => {
              onNavigate();
              if (!n.read) {
                const fd = new FormData();
                fd.set("id", n.id);
                void markNotificationReadAction(fd);
              }
            }}
            className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition hover:bg-surface-hover"
          >
            <span className={n.read ? "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-transparent" : "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]"} aria-hidden />
            <span className="min-w-0">
              <span className={cn("block truncate text-sm", n.read ? "text-secondary" : "font-medium text-primary")}>{n.title}</span>
              {n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
