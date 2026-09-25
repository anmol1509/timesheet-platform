"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { m } from "motion/react";
import { SPRING } from "@/lib/motion";
import {
  LayoutDashboard,
  Users,
  Building2,
  ClipboardList,
  Wrench,
  Upload as UploadIcon,
  FileSpreadsheet,
  BedDouble,
  FileText,
  Clock,
  Settings as SettingsIcon,
  ChevronRight,
  Truck,
  Bus,
  MapPin,
  Receipt,
  Package,
  Wallet,
  ListChecks,
  History,
  Building,
  UserCog,
  ShieldCheck,
  FileSearch,
  BadgeDollarSign,
  FileQuestion,
  FileSignature,
  CalendarClock,
  FilePlus2,
  HardHat,
  FileStack,
  Trash2,
  Banknote,
  Landmark,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { moduleForPath } from "@/lib/permissions";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Match this path only, not its descendants. Needed where one entry's href is
   * a prefix of its siblings' — /demand would otherwise light up alongside
   * /demand/new and /demand/mobilisation.
   */
  exact?: boolean;
  /**
   * Extra path prefixes this entry owns. The per-module dashboards live under
   * /dashboards/* but are reached as tabs of this one row, so they light it up.
   */
  alsoMatch?: string[];
};
type Entry =
  | { type: "link"; item: Item; category: string }
  | { type: "group"; label: string; icon: LucideIcon; children: Item[]; category: string };

const NAV: Entry[] = [
  {
    type: "link",
    item: {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
      alsoMatch: ["/dashboards"],
    },
    category: "Workspace",
  },
  {
    type: "link",
    item: { href: "/approvals", label: "Approvals", icon: ShieldCheck },
    category: "Workspace",
  },
  {
    type: "group",
    label: "Workforce",
    icon: Users,
    category: "Operations",
    children: [
      { href: "/employees", label: "Employees", icon: Users },
      { href: "/employees/instant-view", label: "Instant View", icon: FileSearch },
      { href: "/employees/renewals", label: "Renewals", icon: CalendarClock },
      { href: "/documents", label: "Documents", icon: FileText },
      { href: "/trades", label: "Trades", icon: Wrench },
      { href: "/inventory", label: "PPE & Inventory", icon: Package },
    ],
  },
  {
    type: "group",
    label: "Projects",
    icon: ClipboardList,
    category: "Operations",
    children: [
      { href: "/projects", label: "Projects", icon: ClipboardList },
      { href: "/sites", label: "Sites", icon: MapPin },
    ],
  },
  {
    type: "group",
    label: "Demand",
    icon: ListChecks,
    category: "Operations",
    children: [
      { href: "/demand/new", label: "Create Demand", icon: FilePlus2 },
      { href: "/demand", label: "View Demands", icon: ListChecks, exact: true },
      // One row for the mobilise → arrive → demobilise cycle; the three stages
      // are tabs (see SECTION_TABS), so the sidebar doesn't list each one.
      {
        href: "/demand/mobilisation",
        label: "Deployments",
        icon: HardHat,
        alsoMatch: ["/demand/site-arrival", "/demand/demobilisation"],
      },
      { href: "/demand/documents", label: "Generate Doc", icon: FileStack },
    ],
  },
  {
    type: "group",
    label: "Facilities",
    icon: BedDouble,
    category: "Operations",
    children: [
      { href: "/accommodation/camps", label: "Camps", icon: BedDouble },
      { href: "/accommodation/checkin", label: "Create Check-In", icon: FilePlus2 },
      { href: "/accommodation/bed-allocation", label: "Bed Allocation", icon: ListChecks },
      // Vehicles and Routes are tabs of this one row.
      { href: "/transport", label: "Transport", icon: Bus },
    ],
  },
  {
    type: "group",
    label: "Timesheets",
    icon: FileSpreadsheet,
    category: "Operations",
    children: [
      { href: "/attendance", label: "Daily Attendance", icon: Clock },
      // Daily view and Attendance sync are tabs of this row.
      { href: "/invoices/client-timesheet", label: "Client Timesheet", icon: FileSearch },
      // Upload → Generate Sheets → History is one pipeline; three tabs.
      {
        href: "/upload",
        label: "Import & Generate",
        icon: UploadIcon,
        alsoMatch: ["/companies", "/history"],
      },
    ],
  },
  {
    type: "group",
    label: "Letters",
    icon: FileSignature,
    category: "Operations",
    children: [
      { href: "/letters", label: "Employee Letters", icon: FileSignature },
      { href: "/operations/nocs", label: "NOCs", icon: FileText },
    ],
  },
  {
    type: "group",
    label: "Business Partners",
    icon: Building2,
    category: "Commercial",
    children: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/suppliers", label: "Suppliers", icon: Truck },
      { href: "/suppliers/tickets", label: "Supplier Messages", icon: Inbox, alsoMatch: ["/suppliers/contacts"] },
      { href: "/banks", label: "Banks", icon: Wallet },
    ],
  },
  {
    type: "group",
    label: "Sales",
    icon: BadgeDollarSign,
    category: "Commercial",
    children: [
      { href: "/sales/enquiries", label: "Enquiries", icon: FileQuestion },
      { href: "/sales/quotations", label: "Quotations", icon: FileSignature },
    ],
  },
  {
    type: "group",
    label: "Finance",
    icon: Landmark,
    category: "Commercial",
    children: [
      { href: "/finance", label: "Overview", icon: Landmark, exact: true },
      // Invoice history is a tab of Invoices.
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/finance/bills", label: "Supplier Bills", icon: FileText },
      { href: "/finance/expenses", label: "Expenses", icon: Wallet },
      { href: "/payroll", label: "Payroll", icon: Banknote },
    ],
  },
];

const ADMIN_ITEM: Item = { href: "/settings", label: "Settings", icon: SettingsIcon };

export type NavPage = { href: string; label: string; group: string; icon: LucideIcon };

/** Flattens the nav into one list of every reachable page — consumed by the
 * ⌘K command palette's "Pages" group, so it never drifts out of sync with
 * the sidebar itself. */
export function getNavPages(
  isAdmin: boolean,
  isSuperAdmin: boolean,
  allowedModules: string[] | null = null
): NavPage[] {
  const entries = visibleEntries(isAdmin ? [...NAV, adminGroup(isSuperAdmin)] : NAV, allowedModules);
  const pages: NavPage[] = [];
  for (const entry of entries) {
    if (entry.type === "link") {
      pages.push({ href: entry.item.href, label: entry.item.label, group: entry.category, icon: entry.item.icon });
    } else {
      for (const child of entry.children) {
        pages.push({ href: child.href, label: child.label, group: entry.label, icon: child.icon });
      }
    }
  }
  if (isAdmin) pages.push({ href: ADMIN_ITEM.href, label: ADMIN_ITEM.label, group: "Administration", icon: ADMIN_ITEM.icon });
  return pages;
}

/** Drops nav rows whose module the user can't open (allowed = null → no restriction),
 * and any group left empty. Rows outside every module (dashboard, admin) always stay. */
function visibleEntries(entries: Entry[], allowed: string[] | null): Entry[] {
  if (!allowed) return entries;
  const ok = (item: Item) => {
    const m = moduleForPath(item.href);
    return m === null || allowed.includes(m);
  };
  return entries.flatMap((e): Entry[] => {
    if (e.type === "link") return ok(e.item) ? [e] : [];
    const children = e.children.filter(ok);
    return children.length ? [{ ...e, children }] : [];
  });
}

function adminGroup(isSuperAdmin: boolean): Entry {
  return {
    type: "group",
    label: "Administration",
    icon: ListChecks,
    category: "Administration",
    children: [
      { href: "/settings/company", label: "Company Profile", icon: Building },
      { href: "/settings/team", label: "Team & Access", icon: UserCog },
      { href: "/lookups", label: "Lookups", icon: ListChecks },
      { href: "/letter-templates", label: "Letter Templates", icon: FileText },
      { href: "/audit-log", label: "Audit Log", icon: History },
      // Deletes real data — kept out of the nav (and the page itself
      // redirects away) for anyone but a Super Admin.
      ...(isSuperAdmin
        ? [{ href: "/settings/data-reset", label: "Data Reset", icon: Trash2 }]
        : []),
    ],
  };
}

/** How specifically `item` matches `pathname` — the length of the matched
 * prefix, or null for no match. Used to resolve one winner when several nav
 * items would otherwise all match the same URL (e.g. `/invoices` and
 * `/invoices/client-timesheet` both prefix-match `/invoices/client-timesheet`
 * — only the longer, more specific one should light up). */
function matchSpecificity(pathname: string, item: Item): number | null {
  const alsoMatched = item.alsoMatch?.find(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (alsoMatched) return alsoMatched.length;
  if (item.href === "/" || item.exact) {
    return pathname === item.href ? item.href.length : null;
  }
  if (pathname === item.href || pathname.startsWith(item.href + "/")) {
    return item.href.length;
  }
  return null;
}

/** The single most-specific nav item for the current path, across the whole
 * nav (not just within one group) — see matchSpecificity. Exactly one row
 * (or none) is ever "active" at a time. */
function resolveActiveHref(pathname: string, entries: Entry[]): string | null {
  let bestHref: string | null = null;
  let bestLen = -1;
  function consider(item: Item) {
    const len = matchSpecificity(pathname, item);
    if (len !== null && len > bestLen) {
      bestLen = len;
      bestHref = item.href;
    }
  }
  for (const entry of entries) {
    if (entry.type === "link") consider(entry.item);
    else entry.children.forEach(consider);
  }
  return bestHref;
}

function groupContainsActive(activeHref: string | null, children: Item[]) {
  return children.some((c) => c.href === activeHref);
}

// Active state reads as "selected", not as a coloured button: a tinted surface
// plus a brand rail, so a long nav doesn't turn into a stack of blue blocks.
const ROW =
  "group/row relative flex items-center rounded-control text-sm transition-colors";
const ACTIVE = "bg-brand-soft font-medium text-[var(--brand-primary)]";
const INACTIVE = "text-secondary hover:bg-surface-hover hover:text-primary";

export function NavLinks({
  isAdmin,
  isSuperAdmin,
  allowedModules = null,
  collapsed = false,
  pendingApprovals = 0,
}: {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** Module keys the user may open; null = unrestricted. */
  allowedModules?: string[] | null;
  /** Icon-rail mode. Groups become a single icon with a click-to-open flyout. */
  collapsed?: boolean;
  /** Items waiting for this person, shown as a count on the Approvals row. */
  pendingApprovals?: number;
}) {
  const pathname = usePathname();
  const entries = visibleEntries(isAdmin ? [...NAV, adminGroup(isSuperAdmin)] : NAV, allowedModules);

  // One winner across the *whole* nav, not per group — fixes two rows (in
  // different groups, or a group row and a top-level item) lighting up for
  // the same URL. See matchSpecificity/resolveActiveHref. Cheap enough (~40
  // items) to recompute every render rather than memoize against `entries`,
  // which is itself rebuilt each render.
  const navCandidates = isAdmin
    ? [...entries, { type: "link" as const, item: ADMIN_ITEM, category: "" }]
    : entries;
  const activeHref = resolveActiveHref(pathname, navCandidates);

  // Only records groups the user explicitly toggled. Whether a group is *open*
  // is derived below, so navigating into a group (via search or a deep link)
  // reveals it without an effect syncing state back after the fact.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());

  function isOpen(label: string, children: Item[]) {
    const override = overrides.get(label);
    if (override !== undefined) return override;
    return groupContainsActive(activeHref, children);
  }

  function toggle(label: string, children: Item[]) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(label, !isOpen(label, children));
      return next;
    });
  }

  function renderLeaf(item: Item, depth: 0 | 1, keyPrefix = "") {
    const active = item.href === activeHref;
    const Icon = item.icon;

    if (collapsed) {
      return (
        <Popover.Close key={keyPrefix + item.href} asChild>
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              ROW,
              "gap-2 px-2 py-1.5 text-[13px]",
              active ? ACTIVE : INACTIVE
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        </Popover.Close>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          ROW,
          "gap-2.5 py-1.5",
          depth === 0 ? "px-2.5" : "px-2.5",
          active ? ACTIVE : INACTIVE
        )}
      >
        {active && (
          <m.span
            layoutId="nav-active-rail"
            transition={SPRING}
            className="absolute top-1/2 -left-3 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-[var(--brand-primary)]"
            aria-hidden
          />
        )}
        <Icon className={cn("shrink-0", depth === 0 ? "h-4 w-4" : "h-3.5 w-3.5")} />
        <span className="truncate">{item.label}</span>
        {item.href === "/approvals" && pendingApprovals > 0 && (
          <span className="ml-auto rounded-full bg-[var(--warning)] px-1.5 text-[10px] font-semibold text-white" aria-label={`${pendingApprovals} waiting`}>{pendingApprovals > 99 ? "99+" : pendingApprovals}</span>
        )}
      </Link>
    );
  }

  return (
    <nav className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
      {entries.map((entry, i) => {
        const showCategory = !collapsed && entry.category !== entries[i - 1]?.category;
        const categoryHeader = showCategory && (
          <p
            key={`cat-${entry.category}`}
            className={cn(
              "px-2.5 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-subtle uppercase",
              i === 0 && "pt-1"
            )}
          >
            {entry.category}
          </p>
        );

        if (entry.type === "link") {
          const active = entry.item.href === activeHref;
          const Icon = entry.item.icon;
          if (collapsed) {
            return (
              <Tooltip key={entry.item.href} label={entry.item.label} className="w-full">
                <Link
                  href={entry.item.href}
                  aria-label={entry.item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(ROW, "h-9 w-9 justify-center", active ? ACTIVE : INACTIVE)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                </Link>
              </Tooltip>
            );
          }
          return (
            <div key={entry.item.href} className="contents">
              {categoryHeader}
              {renderLeaf(entry.item, 0)}
            </div>
          );
        }

        const GroupIcon = entry.icon;
        const open = isOpen(entry.label, entry.children);
        const hasActiveChild = groupContainsActive(activeHref, entry.children);

        // Collapsed rail: one icon per GROUP (not per child — flattening every
        // child into the rail left ~40 near-identical icons with no way to
        // tell which section they belonged to). Click opens a flyout listing
        // the group's own children by label.
        if (collapsed) {
          return (
            <Popover.Root key={entry.label}>
              <Tooltip label={entry.label} className="w-full">
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    aria-label={entry.label}
                    className={cn(
                      ROW,
                      "h-9 w-9 justify-center",
                      hasActiveChild ? ACTIVE : INACTIVE
                    )}
                  >
                    <GroupIcon className="h-4 w-4 shrink-0" />
                  </button>
                </Popover.Trigger>
              </Tooltip>
              <Popover.Portal>
                <Popover.Content
                  side="right"
                  align="start"
                  sideOffset={10}
                  className="rx-popover z-50 w-52 rounded-card border border-default bg-surface p-1.5 shadow-popover"
                >
                  <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                    {entry.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {entry.children.map((child) => renderLeaf(child, 1, entry.label))}
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          );
        }

        return (
          <div key={entry.label} className="contents">
            {categoryHeader}
            <div>
            <button
              type="button"
              onClick={() => toggle(entry.label, entry.children)}
              aria-expanded={open}
              className={cn(
                ROW,
                "w-full gap-2.5 px-2.5 py-1.5",
                hasActiveChild && !open
                  ? "font-medium text-primary"
                  : "text-secondary hover:bg-surface-hover hover:text-primary"
              )}
            >
              <GroupIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-left">{entry.label}</span>
              {hasActiveChild && !open && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]"
                  aria-hidden
                />
              )}
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-subtle transition-transform",
                  open && "rotate-90"
                )}
                aria-hidden
              />
            </button>
            {/* CSS grid-rows collapse: 0fr/1fr both instantly measurable (no JS
                height calc needed) and animatable, and it respects the global
                prefers-reduced-motion override (transition-duration: 0.01ms). */}
            <div
              style={{
                display: "grid",
                gridTemplateRows: open ? "1fr" : "0fr",
                transition: "grid-template-rows var(--duration) var(--ease)",
              }}
            >
              <div className="overflow-hidden">
                <div className="mt-0.5 ml-[1.0625rem] flex flex-col gap-0.5 border-l border-default pl-3">
                  {entry.children.map((child) => renderLeaf(child, 1))}
                </div>
              </div>
            </div>
            </div>
          </div>
        );
      })}

      {isAdmin &&
        (collapsed ? (
          <Tooltip label={ADMIN_ITEM.label} className="w-full">
            <Link
              href={ADMIN_ITEM.href}
              aria-label={ADMIN_ITEM.label}
              aria-current={ADMIN_ITEM.href === activeHref ? "page" : undefined}
              className={cn(
                ROW,
                "h-9 w-9 justify-center",
                ADMIN_ITEM.href === activeHref ? ACTIVE : INACTIVE
              )}
            >
              <ADMIN_ITEM.icon className="h-4 w-4 shrink-0" />
            </Link>
          </Tooltip>
        ) : (
          renderLeaf(ADMIN_ITEM, 0)
        ))}
    </nav>
  );
}
