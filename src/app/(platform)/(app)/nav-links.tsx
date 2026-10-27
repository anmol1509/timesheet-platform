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
  Banknote,
  Landmark,
  Inbox,
  FileClock,
  UserCheck,
  type LucideIcon,
  FileOutput,
  Pin,
  Gauge,
  PinOff, KeyRound,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { moduleForPath } from "@/lib/permissions";
import { pathMatches } from "@/lib/navMatch";

export type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Opt-in module: shown only to admins and to roles that name it, never by default (see OPT_IN_MODULES). */
  needs?: string;
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
export type Entry =
  | { type: "link"; item: Item; category: string }
  | { type: "group"; label: string; icon: LucideIcon; children: Item[]; category: string };

export const NAV: Entry[] = [
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
      { href: "/letters", label: "All Letters", icon: FileSignature },
      { href: "/operations/nocs", label: "NOC", icon: FileText },
      { href: "/letter-templates", label: "Templates", icon: FileStack },
    ],
  },
  // A candidate becomes a worker, so onboarding sits with the people it leads to. "Add candidate" is a
  // button on the tracker (and in the command palette), not a page of its own in the menu.
  {
    type: "link",
    item: { href: "/onboarding", label: "Onboarding", icon: UserCheck },
    category: "People",
  },
  // Operations: demand, the projects it serves, and the camps and transport behind it.
  {
    type: "group",
    label: "Demand",
    icon: ListChecks,
    category: "Operations",
    children: [
      // A demand's own pages (/demand/<id>, /demand/new) belong here; /demand/<id>/mobilise and /documents are claimed below by their longer patterns.
      { href: "/demand", label: "Demands", icon: ListChecks, exact: true, alsoMatch: ["/demand/*"] },
      // One row for the mobilise → arrive → demobilise cycle; the three stages
      // are tabs (see SECTION_TABS), so the sidebar doesn't list each one.
      {
        href: "/demand/mobilisation",
        label: "Deployments",
        icon: HardHat,
        alsoMatch: ["/demand/site-arrival", "/demand/demobilisation", "/demand/*/mobilise"],
      },
      { href: "/demand/documents", label: "Generate Doc", icon: FileStack, alsoMatch: ["/demand/*/documents"] },
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
      { href: "/accommodation/checkin", label: "Check-In", icon: FilePlus2 },
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
      // Invoice history is a tab of Invoices.
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/payroll", label: "Payroll", icon: Banknote },
      { href: "/finance/bills", label: "Supplier Bills", icon: FileText },
      { href: "/finance/expenses", label: "Expenses", icon: Wallet },
      { href: "/finance/books", label: "Accounting", icon: BookOpen },
      { href: "/finance", label: "Budgets & trends", icon: Landmark, exact: true },
    ],
  },
  // Commercial: who you sell to and buy from.
  {
    type: "group",
    label: "Sales",
    icon: BadgeDollarSign,
    category: "Commercial",
    children: [
      { href: "/sales", label: "Pipeline", icon: TrendingUp, exact: true },
      { href: "/sales/enquiries", label: "Enquiries", icon: FileQuestion },
      { href: "/sales/quotations", label: "Quotations", icon: FileSignature },
    ],
  },
  { type: "link", category: "Commercial", item: { href: "/my-companies", label: "My Companies", icon: Landmark, needs: "mycompanies" } },
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
];

export type NavPage = { href: string; label: string; group: string; icon: LucideIcon };

/** Flattens the nav into one list of every reachable page — consumed by the
 * ⌘K command palette's "Pages" group, so it never drifts out of sync with
 * the sidebar itself. */
export function getNavPages(
  isAdmin: boolean,
  isSuperAdmin: boolean,
  allowedModules: string[] | null = null
): NavPage[] {
  const entries = visibleEntries(isAdmin ? [...NAV, adminGroup()] : NAV, allowedModules, isAdmin);
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
  return pages;
}

/** Drops nav rows whose module the user can't open (allowed = null → no restriction),
 * and any group left empty. Rows outside every module (dashboard, admin) always stay. */
export function visibleEntries(entries: Entry[], allowed: string[] | null, isAdmin: boolean): Entry[] {
  const optIn = (item: Item) => !item.needs || isAdmin || !!allowed?.includes(item.needs);
  const ok = (item: Item) => {
    if (!optIn(item)) return false;
    if (!allowed) return true;
    const m = moduleForPath(item.href);
    return m === null || allowed.includes(m);
  };
  return entries.flatMap((e): Entry[] => {
    if (e.type === "link") return ok(e.item) ? [e] : [];
    const children = e.children.filter(ok);
    return children.length ? [{ ...e, children }] : [];
  });
}

/** The owner's own two pages, shown above everything else on the owner's deployment only. */
export function ownerEntries(): Entry[] {
  return [
    { type: "link", category: "Owner", item: { href: "/owner", label: "Customers", icon: Building2, exact: true } },
    { type: "link", category: "Owner", item: { href: "/owner/costs", label: "Costs & capacity", icon: Gauge } },
  ];
}

/** Every nav entry this person sees, before the module filter. */
export function allEntries(isAdmin: boolean, isOwner: boolean): Entry[] {
  return [...(isOwner ? ownerEntries() : []), ...NAV, ...(isAdmin ? [adminGroup()] : [])];
}

export function adminGroup(): Entry {
  return {
    type: "group",
    label: "Administration",
    icon: ListChecks,
    category: "Setup",
    children: [
      { href: "/settings/company", label: "Company", icon: Building, alsoMatch: ["/settings"] },
      { href: "/settings/team", label: "Team & Access", icon: UserCog, alsoMatch: ["/settings/roles", "/settings/developers"] },
      { href: "/import", label: "Data", icon: UploadIcon, alsoMatch: ["/data-health", "/lookups", "/settings/data-reset", "/settings/document-types"] },
      { href: "/audit-log", label: "Audit & feedback", icon: History, alsoMatch: ["/settings/assistant"] },
    ],
  };
}

/** How specifically `item` matches `pathname` — the length of the matched
 * prefix, or null for no match. Used to resolve one winner when several nav
 * items would otherwise all match the same URL (e.g. `/invoices` and
 * `/invoices/client-timesheet` both prefix-match `/invoices/client-timesheet`
 * — only the longer, more specific one should light up). */
function matchSpecificity(pathname: string, item: Item): number | null {
  const alsoMatched = item.alsoMatch?.find((p) => pathMatches(pathname, p));
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
export function resolveActiveHref(pathname: string, entries: Entry[]): string | null {
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

export function groupContainsActive(activeHref: string | null, children: Item[]) {
  return children.some((c) => c.href === activeHref);
}

// Active state reads as "selected", not as a coloured button: a tinted surface
// plus a brand rail, so a long nav doesn't turn into a stack of blue blocks.
export const ROW =
  "group/row relative flex items-center rounded-[10px] text-[13.5px] transition-colors";
export const ACTIVE =
  "glass-pill font-semibold text-[var(--brand-primary)]";
export const INACTIVE = "text-secondary hover:bg-[color-mix(in_srgb,var(--surface)_55%,transparent)] hover:text-primary";

/* ---- Per-browser sidebar preferences (open group, pinned pages) -------------
 * Read through useSyncExternalStore so the server render and first client
 * render agree (both see "nothing saved") and the saved value then arrives
 * without an effect pushing state around. */
const OPEN_KEY = "nav.openGroups";
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
function parseList(raw: string | null): Set<string> {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
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
  query = "",
  labels = false,
  isOwner = false,
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
  /** Search-first layout: while there is text, the list shows only matching pages. */
  query?: string;
  /** Icon-rail mode: show each page or group name under its icon. */
  labels?: boolean;
  /** Show the owner's pages (Customers, Costs & capacity) at the top. */
  isOwner?: boolean;
}) {
  const pathname = usePathname();
  const entries = visibleEntries(allEntries(isAdmin, isOwner), allowedModules, isAdmin);
  const q = query.trim().toLowerCase();
  const listed: Entry[] = q
    ? entries.flatMap((e): Entry[] =>
        e.type === "link"
          ? e.item.label.toLowerCase().includes(q) ? [{ ...e, category: "Results" }] : []
          : e.children.filter((c) => c.label.toLowerCase().includes(q) || e.label.toLowerCase().includes(q)).map((item) => ({ type: "link", item, category: "Results" }))
      )
    : entries;

  // One winner across the *whole* nav, not per group — fixes two rows (in
  // different groups, or a group row and a top-level item) lighting up for
  // the same URL. See matchSpecificity/resolveActiveHref. Cheap enough (~40
  // items) to recompute every render rather than memoize against `entries`,
  // which is itself rebuilt each render.
  const activeHref = resolveActiveHref(pathname, entries);

  // Any number of groups can be open. What is open comes from the groups this browser last left open, plus
  // the group holding the current page (so a deep link or a search result reveals where you are). Collapsing
  // the current page's group sticks until you navigate somewhere else.
  const openRaw = usePref(OPEN_KEY);
  const openSet = useMemo(() => parseList(openRaw), [openRaw]);
  const [collapsedHere, setCollapsedHere] = useState<{ path: string; group: string } | null>(null);
  let activeGroup: string | null = null;
  for (const e of entries) if (e.type === "group" && groupContainsActive(activeHref, e.children)) activeGroup = e.label;

  // Remember the group you are working in, for the next visit.
  useEffect(() => {
    if (!activeGroup) return;
    const saved = parseList(readPref(OPEN_KEY));
    if (!saved.has(activeGroup)) writePref(OPEN_KEY, JSON.stringify([...saved, activeGroup]));
  }, [activeGroup]);

  function isOpen(label: string) {
    if (openSet.has(label)) return true;
    return label === activeGroup && !(collapsedHere?.path === pathname && collapsedHere.group === label);
  }

  function toggle(label: string) {
    const next = new Set(openSet);
    if (isOpen(label)) {
      next.delete(label);
      if (label === activeGroup) setCollapsedHere({ path: pathname, group: label });
    } else {
      next.add(label);
      if (collapsedHere?.group === label) setCollapsedHere(null);
    }
    writePref(OPEN_KEY, JSON.stringify([...next]));
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
    return m;
  }, [entries]);
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
    // A pinned shortcut repeats a page that is also listed in its group; only the group row shows as current.
    const active = item.href === activeHref && keyPrefix !== "pin-";
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
            depth === 0 ? "gap-3 px-2.5 py-1" : "gap-2.5 px-2.5 py-1 text-[13px]",
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
            // Out of the tab order except on the page you are on, so it no longer doubles the stops to reach the content.
            tabIndex={active ? 0 : -1}
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
    <nav aria-label="Main" className={cn("flex flex-col gap-px", collapsed && "items-center")}>
      {q && listed.length === 0 && <p className="px-2.5 py-3 text-[13px] text-muted">No page matches “{query.trim()}”.</p>}
      {!collapsed && !q && pins.length > 0 && (
        <div className="contents">
          <p className="px-2.5 pt-1.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Pinned</p>
          {pins.map((href) => renderLeaf(itemByHref.get(href)!, 0, "pin-", { rail: false, pin: false }))}
        </div>
      )}
      {listed.map((entry, i) => {
        const showCategory = !collapsed && entry.category !== listed[i - 1]?.category;
        const categoryHeader = showCategory && (
          <p
            key={`cat-${entry.category}`}
            className={cn(
              "px-2.5 pt-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase",
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
                  className={cn(ROW, labels ? "w-full flex-col gap-0.5 px-0.5 py-1.5" : "h-9 w-9 justify-center", active ? ACTIVE : INACTIVE)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {labels && <span className="line-clamp-2 w-full text-center text-[10px] leading-[1.15] break-words">{entry.item.label}</span>}
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
                      labels ? "w-full flex-col gap-0.5 px-0.5 py-1.5" : "h-9 w-9 justify-center",
                      hasActiveChild ? ACTIVE : INACTIVE
                    )}
                  >
                    <GroupIcon className="h-4 w-4 shrink-0" />
                    {labels && <span className="line-clamp-2 w-full text-center text-[10px] leading-[1.15] break-words">{entry.label === "Administration" ? "Admin" : entry.label}</span>}
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
                "w-full gap-3 px-2.5 py-1",
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
    </nav>
  );
}
