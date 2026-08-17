"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  Landmark,
  Wallet,
  ListChecks,
  History,
  FileSearch,
  BadgeDollarSign,
  FileQuestion,
  FileSignature,
  CalendarClock,
  FilePlus2,
  HardHat,
  FileStack,
  type LucideIcon,
} from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

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
};
type Entry =
  | { type: "link"; item: Item }
  | { type: "group"; label: string; icon: LucideIcon; children: Item[] };

const NAV: Entry[] = [
  { type: "link", item: { href: "/", label: "Dashboard", icon: LayoutDashboard } },
  {
    type: "group",
    label: "Workforce",
    icon: Users,
    children: [
      { href: "/employees", label: "Employees", icon: Users },
      { href: "/employees/instant-view", label: "Instant View", icon: FileSearch },
      { href: "/employees/renewals", label: "Renewals", icon: CalendarClock },
      { href: "/trades", label: "Trades", icon: Wrench },
      { href: "/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    type: "group",
    label: "Business Partners",
    icon: Building2,
    children: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/suppliers", label: "Suppliers", icon: Truck },
      { href: "/sponsorship-companies", label: "Sponsorship Companies", icon: Landmark },
      { href: "/banks", label: "Banks", icon: Wallet },
    ],
  },
  {
    type: "group",
    label: "Sales",
    icon: BadgeDollarSign,
    children: [
      { href: "/sales/enquiries", label: "Enquiries", icon: FileQuestion },
      { href: "/sales/quotations", label: "Quotations", icon: FileSignature },
    ],
  },
  {
    type: "group",
    label: "Projects",
    icon: ClipboardList,
    children: [
      { href: "/projects", label: "Projects", icon: ClipboardList },
      { href: "/operations/nocs", label: "NOCs", icon: FileText },
    ],
  },
  {
    type: "group",
    label: "Demand",
    icon: ListChecks,
    children: [
      { href: "/demand/new", label: "Create Demand", icon: FilePlus2 },
      { href: "/demand", label: "View Demands", icon: ListChecks, exact: true },
      { href: "/demand/mobilisation", label: "Mobilization", icon: HardHat },
      { href: "/demand/documents", label: "Generate Doc", icon: FileStack },
    ],
  },
  {
    type: "group",
    label: "Facilities",
    icon: BedDouble,
    children: [
      { href: "/accommodation", label: "Accommodation", icon: BedDouble },
      { href: "/transport", label: "Transport", icon: Bus },
      { href: "/transport/routes", label: "Routes", icon: MapPin },
      { href: "/inventory", label: "Inventory", icon: Package },
    ],
  },
  {
    type: "group",
    label: "Timesheets",
    icon: FileSpreadsheet,
    children: [
      { href: "/attendance", label: "Daily Attendance", icon: Clock },
      { href: "/invoices/client-timesheet", label: "Client Timesheet", icon: FileSearch },
      { href: "/upload", label: "Upload", icon: UploadIcon },
      { href: "/companies", label: "Generate Sheets", icon: FileSpreadsheet },
      { href: "/history", label: "History", icon: Clock },
    ],
  },
  {
    type: "group",
    label: "Billing",
    icon: Receipt,
    children: [
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/invoices/history", label: "Invoice History", icon: Clock },
    ],
  },
];

const ADMIN_ITEM: Item = { href: "/settings", label: "Settings", icon: SettingsIcon };

const ADMIN_GROUP: Entry = {
  type: "group",
  label: "Administration",
  icon: ListChecks,
  children: [
    { href: "/lookups", label: "Lookups", icon: ListChecks },
    { href: "/letter-templates", label: "Letter Templates", icon: FileText },
    { href: "/audit-log", label: "Audit Log", icon: History },
  ],
};

function isActive(pathname: string, href: string, exact = false) {
  if (href === "/" || exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function groupContainsActive(pathname: string, children: Item[]) {
  // Deliberately ignores `exact`: a group should stay open anywhere inside its
  // section, including detail pages like /demand/<id> that no child matches.
  return children.some((c) => isActive(pathname, c.href));
}

// Active state reads as "selected", not as a coloured button: a tinted surface
// plus a brand rail, so a long nav doesn't turn into a stack of blue blocks.
const ROW =
  "group/row relative flex items-center rounded-control text-sm transition-colors";
const ACTIVE = "bg-brand-soft font-medium text-[var(--brand-primary)]";
const INACTIVE = "text-secondary hover:bg-surface-hover hover:text-primary";

export function NavLinks({
  isAdmin,
  collapsed = false,
}: {
  isAdmin: boolean;
  /** Icon-rail mode. Groups flatten to their icon with a hover tooltip. */
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const entries = isAdmin ? [...NAV, ADMIN_GROUP] : NAV;

  // Only records groups the user explicitly toggled. Whether a group is *open*
  // is derived below, so navigating into a group (via search or a deep link)
  // reveals it without an effect syncing state back after the fact.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());

  function isOpen(label: string, children: Item[]) {
    const override = overrides.get(label);
    if (override !== undefined) return override;
    return groupContainsActive(pathname, children);
  }

  function toggle(label: string, children: Item[]) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(label, !isOpen(label, children));
      return next;
    });
  }

  function renderLeaf(item: Item, depth: 0 | 1) {
    const active = isActive(pathname, item.href, item.exact);
    const Icon = item.icon;

    if (collapsed) {
      return (
        <Tooltip key={item.href} label={item.label} className="w-full">
          <Link
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(ROW, "h-9 w-9 justify-center", active ? ACTIVE : INACTIVE)}
          >
            <Icon className="h-4 w-4 shrink-0" />
          </Link>
        </Tooltip>
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
          <span
            className="absolute top-1/2 -left-3 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-[var(--brand-primary)]"
            aria-hidden
          />
        )}
        <Icon className={cn("shrink-0", depth === 0 ? "h-4 w-4" : "h-3.5 w-3.5")} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <nav className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
      {entries.map((entry) => {
        if (entry.type === "link") return renderLeaf(entry.item, 0);

        const GroupIcon = entry.icon;
        const open = isOpen(entry.label, entry.children);
        const hasActiveChild = groupContainsActive(pathname, entry.children);

        // Collapsed rail: show each group's children as bare icons, since a
        // disclosure control has nothing to disclose into at 56px wide.
        if (collapsed) {
          return (
            <div key={entry.label} className="flex w-full flex-col items-center gap-0.5">
              <span
                className="my-1 h-px w-5 bg-[var(--border)]"
                aria-hidden
              />
              {entry.children.map((child) => renderLeaf(child, 1))}
            </div>
          );
        }

        return (
          <div key={entry.label}>
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
            {open && (
              <div className="mt-0.5 ml-[1.0625rem] flex flex-col gap-0.5 border-l border-default pl-3">
                {entry.children.map((child) => renderLeaf(child, 1))}
              </div>
            )}
          </div>
        );
      })}

      {isAdmin && renderLeaf(ADMIN_ITEM, 0)}
    </nav>
  );
}
