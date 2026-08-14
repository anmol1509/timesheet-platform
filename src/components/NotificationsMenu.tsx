"use client";

import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { Bell, ShieldCheck } from "lucide-react";
import type { ComplianceAlert } from "@/lib/dashboardAlerts";
import { cn } from "@/lib/cn";

/**
 * Compliance alerts, surfaced from the same `getComplianceAlerts` query the
 * shell was already running for the unread dot — previously the bell was a
 * button that did nothing.
 */
export function NotificationsMenu({ alerts }: { alerts: ComplianceAlert[] }) {
  const overdue = alerts.filter((a) => a.days < 0);
  const soon = alerts.filter((a) => a.days >= 0);
  const shown = alerts.slice(0, 8);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={
            alerts.length > 0
              ? `Notifications — ${alerts.length} compliance alerts`
              : "Notifications"
          }
          className="relative shrink-0 rounded-md p-2 text-muted transition hover:bg-surface-hover hover:text-primary"
        >
          <Bell className="h-4.5 w-4.5" />
          {alerts.length > 0 && (
            <span
              className={cn(
                "absolute top-1 right-1 h-2 w-2 rounded-full ring-2 ring-[var(--surface)]",
                overdue.length > 0 ? "bg-[var(--error)]" : "bg-[var(--warning)]"
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
          className="rx-popover z-50 w-[22rem] overflow-hidden rounded-card border border-default bg-surface shadow-popover"
        >
          <div className="flex items-center justify-between border-b border-default px-3.5 py-2.5">
            <p className="text-sm font-semibold text-primary">Compliance alerts</p>
            {alerts.length > 0 && (
              <span className="text-xs text-muted">
                {overdue.length > 0 && (
                  <span className="font-medium text-[var(--error)]">
                    {overdue.length} expired
                  </span>
                )}
                {overdue.length > 0 && soon.length > 0 && " · "}
                {soon.length > 0 && `${soon.length} due soon`}
              </span>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <ShieldCheck className="mb-2 h-5 w-5 text-[var(--success)]" aria-hidden />
              <p className="text-sm font-medium text-primary">All documents current</p>
              <p className="mt-1 text-xs text-muted">
                Nothing expires in the next 30 days.
              </p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {shown.map((alert) => (
                <li key={`${alert.employeeId}-${alert.field}`}>
                  <Link
                    href={`/employees/${alert.employeeId}`}
                    className="flex items-start justify-between gap-3 px-3.5 py-2 transition hover:bg-surface-hover"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-primary">
                        {alert.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {alert.field}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium whitespace-nowrap",
                        alert.days < 0
                          ? "text-[var(--error)]"
                          : "text-[var(--warning)]"
                      )}
                    >
                      {alert.days < 0
                        ? `${Math.abs(alert.days)}d overdue`
                        : alert.days === 0
                          ? "Today"
                          : `in ${alert.days}d`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {alerts.length > shown.length && (
            <div className="border-t border-default px-3.5 py-2">
              <Link
                href="/documents"
                className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
              >
                View all {alerts.length} alerts
              </Link>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
