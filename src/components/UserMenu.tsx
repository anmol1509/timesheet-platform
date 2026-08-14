"use client";

import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, LogOut, Settings } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  BRANCH_ADMIN: "Branch admin",
  STAFF: "Staff",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

/**
 * Account menu. Collapses the name/email block and the standalone "Sign out"
 * button that previously sat side by side in the header.
 */
export function UserMenu({
  name,
  email,
  role,
  isAdmin,
}: {
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${name}`}
          className="flex shrink-0 items-center gap-2 rounded-md p-1 pr-1.5 transition hover:bg-surface-hover"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-[var(--brand-navy)] text-[11px] font-semibold text-white">
            {initials(name)}
          </span>
          <span className="hidden max-w-32 truncate text-sm font-medium text-secondary md:block">
            {name}
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-subtle md:block" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="rx-popover z-50 w-60 overflow-hidden rounded-card border border-default bg-surface shadow-popover"
        >
          <div className="border-b border-default px-3.5 py-3">
            <p className="truncate text-sm font-medium text-primary">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
            <p className="mt-1.5 inline-flex rounded-md bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-secondary">
              {ROLE_LABELS[role] ?? role}
            </p>
          </div>
          <div className="p-1">
            {isAdmin && (
              <Link
                href="/settings"
                className="flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm text-secondary transition hover:bg-surface-hover hover:text-primary"
              >
                <Settings className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
                Settings
              </Link>
            )}
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-sm text-secondary transition hover:bg-surface-hover hover:text-primary"
              >
                <LogOut className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
