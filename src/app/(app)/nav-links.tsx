"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  FileClock,
  UserCheck,
  type LucideIcon,
  HeartPulse,
  FileOutput,
  Pin,
  PinOff, KeyRound } from "lucide-react";
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
    category: "Home",
  },
  {
    type: "link",
    item: { href: "/approvals", label: "Approvals", icon: ShieldCheck },
    category: "Home",
  },
  {
    type: "link",
    item: { href: "/drafts", label: "Drafts", icon: FileClock },
    category: "Home",
  },
  // People: the journey of a worker, from candidate to employee.
  {
    type: "group",
    label: "Workforce",
    icon: Users,
    category: "People",
    children: [
      { href: "/employees", label: "Employees", icon: Users },
      { href: "/employees/instant-view", label: "Instant View", icon: FileSearch },
      { href: "/employees/renewals", label: "Renewals", icon: CalendarClock },
      { href: "/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    type: "group",
    label: "Letters",
    icon: FileSignature,
    category: "People",
    children: [
      { href: "/letters", label: "Employee Letters", icon: FileSignature },
      { href: "/operations/nocs", label: "NOCs", icon: FileText },
    ],
  },
  // Operations: demand, the projects it serves, and the camps and transport behind it.
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
    label: "Facilities",
    icon: BedDouble,
    category: "Operations",
    children: [
      { href: "/accommodation/camps", label: "Camps", icon: BedDouble },
      { href: "/accommodation/checkin", label: "Create Check-In", icon: FilePlus2 },
      { href: "/accommodation/bed-allocation", label: "Bed Allocation", icon: ListChecks },
      // Vehicles and Routes are tabs of this one row.
      { href: "/transport", label: "Transport", icon: Bus },
      { href: "/inventory", label: "Inventory", icon: Package },
    ],
  },
  // Time & Billing: hours worked, then what is invoiced and paid for them.
  {
    type: "group",
    label: "Timesheets",
    icon: FileSpreadsheet,
    category: "Time & Billing",
    children: [
      { href: "/attendance", label: "Daily Attendance", icon: Clock },
      // Daily view and Attendance sync are tabs of this row.
      { href: "/invoices/client-timesheet", label: "Client Timesheet", icon: FileSearch },
      // Generate Sheets and History are the tabs of this row.
      {
        href: "/companies",
        label: "Generate",
        icon: FileOutput,
        alsoMatch: ["/history", "/upload"],
      },
    ],
  },
  {
    type: "group",
    label: "Finance",
    icon: Landmark,
    category: "Time & Billing",
    children: [
      { href: "/finance", label: "Overview", icon: Landmark, exact: true },
      // Invoice history is a tab of Invoices.
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/payroll", label: "Payroll", icon: Banknote },
      { href: "/finance/bills", label: "Supplier Bills", icon: FileText },
      { href: "/finance/expenses", label: "Expenses", icon: Wallet },
    ],
  },
  // Commercial: who you sell to and buy from.
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
    label: "Business Partners",
    icon: Building2,
    category: "Commercial",
    children: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/suppliers", label: "Suppliers", icon: Truck },
      { href: "/suppliers/tickets", label: "Supplier Messages", icon: Inbox, alsoMatch: ["/suppliers/contacts"] },
    ],
  },
  // Setup: reference lists that change rarely.
  {
    type: "group",
    label: "Reference Data",
    icon: Wrench,
    category: "Setup",
    children: [
      { href: "/trades", label: "Trades", icon: Wrench },
      { href: "/banks", label: "Banks", icon: Wallet },
    ],
  },
  // Onboarding is still being worked on, so it sits at the very bottom of the list, out of the way.
  {
    type: "group",
    label: "Onboarding",
    icon: UserCheck,
    category: "Setup",
    children: [
      { href: "/onboarding", label: "Candidate Tracker", icon: ListChecks, exact: true },
      { href: "/onboarding/new", label: "Add Candidate", icon: FilePlus2 },
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
  const entries = visibleEntries(isAdmin ? [...NAV, adminGroup()] : NAV, allowedModules);
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

function adminGroup(): Entry {
  return {
    type: "group",
    label: "Administration",
    icon: ListChecks,
    category: "Setup",
    children: [
      { href: "/settings/company", label: "Company Profile", icon: Building },
      { href: "/import", label: "Import Data", icon: UploadIcon },
      { href: "/data-health", label: "Data health", icon: HeartPulse },
      { href: "/settings/team", label: "Team & Access", icon: UserCog },
      { href: "/settings/developers", label: "Developers", icon: KeyRound },
      { href: "/lookups", label: "Lookups", icon: ListChecks },
      { href: "/letter-templates", label: "Letter Templates", icon: FileText },
      { href: "/audit-log", label: "Audit Log", icon: History },
      // Deletes real data. The whole group is admin-only; the page and its
      // actions additionally confine a branch admin to their own branch.
      { href: "/settings/data-reset", label: "Data Reset", icon: Trash2 },
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
  "group/row relative flex items-center rounded-[10px] text-[13.5px] transition-colors";
const ACTIVE =
  "bg-brand-soft font-semibold text-[var(--brand-primary)] shadow-[inset_0_0_0_1px_var(--brand-primary-border)]";
const INACTIVE = "text-secondary hover:bg-surface-hover hover:text-primary";

/* ---- Per-browser sidebar preferences (open group, pinned pages) -------------
 * Read through useSyncExternalStore so the server render and first client
 * render agree (both see "nothing saved") and the saved value then arrives
 * without an effect pushing state around. */
const OPEN_KEY = "nav.openGroup";
const PINS_KEY = "nav.pins";
const MAX_PINS = 6;
const PREFS_EVENT = "nav-prefs";

function subscribePrefs(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(PREFS_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(PREFS_EVENT, cb);
  };
}
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
  window.dispatchEvent(new Event(PREFS_EVENT));
}
function usePref(key: string) {
  return useSyncExternalStore(subscribePrefs, () => readPref(key), () => null);
}

export function NavLinks({
  isAdmin,
  allowedModules = null,
  collapsed = false,
  pendingApprovals = 0,
  badges = {},
}: {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** Module keys the user may open; null = unrestricted. */
  allowedModules?: string[] | null;
  /** Icon-rail mode. Groups become a single icon with a click-to-open flyout. */
  collapsed?: boolean;
  /** Items waiting for this person, shown as a count on the Approvals row. */
  pendingApprovals?: number;
  /** Other rows that need someone to act, by href — shown as a count. */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const entries = visibleEntries(isAdmin ? [...NAV, adminGroup()] : NAV, allowedModules);

  // One winner across the *whole* nav, not per group — fixes two rows (in
  // different groups, or a group row and a top-level item) lighting up for
  // the same URL. See matchSpecificity/resolveActiveHref. Cheap enough (~40
  // items) to recompute every render rather than memoize against `entries`,
  // which is itself rebuilt each render.
  const navCandidates = isAdmin
    ? [...entries, { type: "link" as const, item: ADMIN_ITEM, category: "" }]
    : entries;
  const activeHref = resolveActiveHref(pathname, navCandidates);

  // One group open at a time. What is open comes from, in order: a choice made
  // on this page (cleared by navigating), the group holding the current page,
  // then the group that was open last time. Navigating into a group (via
  // search or a deep link) therefore reveals it with no effect syncing state.
  const [choice, setChoice] = useState<{ path: string; group: string | null } | null>(null);
  const rememberedRaw = usePref(OPEN_KEY);
  const remembered = rememberedRaw || null;
  let activeGroup: string | null = null;
  for (const e of entries) if (e.type === "group" && groupContainsActive(activeHref, e.children)) activeGroup = e.label;
  const chosen = choice && choice.path === pathname ? choice : null;
  const openLabel = chosen ? chosen.group : (activeGroup ?? remembered);

  // Remember the group you were last working in, for the next visit.
  useEffect(() => {
    if (activeGroup) writePref(OPEN_KEY, activeGroup);
  }, [activeGroup]);

  function isOpen(label: string) {
    return openLabel === label;
  }

  function toggle(label: string) {
    const next = openLabel === label ? null : label;
    setChoice({ path: pathname, group: next });
    writePref(OPEN_KEY, next ?? "");
  }

  // Pinned pages: a short list kept at the top, saved in this browser. Only pages
  // this person can open are kept (entries is already permission-filtered).
  const pinsRaw = usePref(PINS_KEY);
  const itemByHref = useMemo(() => {
    const m = new Map<string, Item>();
    for (const e of entries) {
      if (e.type === "link") m.set(e.item.href, e.item);
      else for (const c of e.children) m.set(c.href, c);
    }
    if (isAdmin) m.set(ADMIN_ITEM.href, ADMIN_ITEM);
    return m;
  }, [entries, isAdmin]);
  const pins = useMemo(() => {
    let list: string[] = [];
    try {
      const parsed = JSON.parse(pinsRaw ?? "[]");
      if (Array.isArray(parsed)) list = parsed.filter((h): h is string => typeof h === "string");
    } catch {
      /* ignore a corrupt value */
    }
    return list.filter((h) => itemByHref.has(h)).slice(0, MAX_PINS);
  }, [pinsRaw, itemByHref]);

  function togglePin(href: string) {
    const next = pins.includes(href) ? pins.filter((h) => h !== href) : pins.length < MAX_PINS ? [...pins, href] : pins;
    writePref(PINS_KEY, JSON.stringify(next));
  }

  const countFor = (href: string) => (href === "/approvals" ? pendingApprovals : badges[href] ?? 0);

  function renderLeaf(item: Item, depth: 0 | 1, keyPrefix = "", opts: { rail?: boolean; pin?: boolean } = {}) {
    const { rail = true, pin = true } = opts;
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

    const count = countFor(item.href);
    const isPinned = pins.includes(item.href);
    const canPin = pin && (isPinned || pins.length < MAX_PINS);
    return (
      <div key={keyPrefix + item.href} className="group/pin relative">
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            ROW,
            depth === 0 ? "gap-3 px-2.5 py-2" : "gap-2.5 px-2.5 py-1.5 text-[13px]",
            active ? ACTIVE : INACTIVE
          )}
        >
          {active && rail && (
            <m.span
              layoutId="nav-active-rail"
              transition={SPRING}
              className="absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--brand-primary)]"
              aria-hidden
            />
          )}
          <Icon className={cn("shrink-0", depth === 0 ? "h-[18px] w-[18px]" : "h-4 w-4", !active && "text-muted group-hover/row:text-secondary")} />
          <span className="truncate">{item.label}</span>
          {count > 0 && (
            <span
              className={cn(
                "tabular ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold text-white transition-opacity group-hover/pin:opacity-0 group-focus-within/pin:opacity-0",
                item.href === "/approvals" ? "bg-[var(--error)]" : "bg-[var(--warning)]"
              )}
              aria-label={`${count} need attention`}
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Link>
        {pin && (
          <button
            type="button"
            onClick={() => togglePin(item.href)}
            disabled={!canPin}
            aria-label={isPinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
            aria-pressed={isPinned}
            title={isPinned ? "Unpin" : canPin ? "Pin to the top" : `You can pin up to ${MAX_PINS} pages`}
            className="absolute top-1/2 right-1.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-subtle opacity-0 transition hover:bg-surface-hover hover:text-primary focus-visible:opacity-100 group-hover/pin:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
          >
            {isPinned ? <PinOff className="h-3.5 w-3.5" aria-hidden /> : <Pin className="h-3.5 w-3.5" aria-hidden />}
          </button>
        )}
      </div>
    );
  }

  return (
    <nav className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
      {!collapsed && pins.length > 0 && (
        <div className="contents">
          <p className="px-2.5 pt-1.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-subtle uppercase">Pinned</p>
          {pins.map((href) => renderLeaf(itemByHref.get(href)!, 0, "pin-", { rail: false, pin: false }))}
        </div>
      )}
      {entries.map((entry, i) => {
        const showCategory = !collapsed && entry.category !== entries[i - 1]?.category;
        const categoryHeader = showCategory && (
          <p
            key={`cat-${entry.category}`}
            className={cn(
              "px-2.5 pt-5 pb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-subtle uppercase",
              i === 0 && "pt-1.5"
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
        const open = isOpen(entry.label);
        const hasActiveChild = groupContainsActive(activeHref, entry.children);
        const groupCount = entry.children.reduce((n, c) => n + countFor(c.href), 0);

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
              onClick={() => toggle(entry.label)}
              aria-expanded={open}
              className={cn(
                ROW,
                "w-full gap-3 px-2.5 py-2",
                hasActiveChild
                  ? "font-semibold text-primary hover:bg-surface-hover"
                  : "text-secondary hover:bg-surface-hover hover:text-primary"
              )}
            >
              <GroupIcon className={cn("h-[18px] w-[18px] shrink-0", hasActiveChild ? "text-[var(--brand-primary)]" : "text-muted")} />
              <span className="flex-1 truncate text-left">{entry.label}</span>
              {!open && (hasActiveChild || groupCount > 0) && (
                <span
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", groupCount > 0 ? "bg-[var(--error)]" : "bg-[var(--brand-primary)]")}
                  title={groupCount > 0 ? `${groupCount} need attention` : undefined}
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
                <div
                  className="mt-0.5 mb-1 ml-[1.125rem] flex flex-col gap-0.5 border-l border-default pl-3"
                  style={{
                    opacity: open ? 1 : 0,
                    transform: open ? "translateY(0)" : "translateY(-4px)",
                    transition: "opacity var(--duration) var(--ease), transform var(--duration) var(--ease)",
                  }}
                  inert={!open}
                >
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
