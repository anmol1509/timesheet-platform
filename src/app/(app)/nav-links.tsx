"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Building2,
  ClipboardList,
  Wrench,
  Upload as UploadIcon,
  FileSpreadsheet,
  BedDouble,
  FileText,
  Clock,
  Settings as SettingsIcon,
  ChevronDown,
  Truck,
  Bus,
  MapPin,
  PenSquare,
  Receipt,
  Package,
  Landmark,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };
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
      { href: "/employees/new", label: "Add Employee", icon: UserPlus },
      { href: "/skills", label: "Skills", icon: Wrench },
      { href: "/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    type: "group",
    label: "Operations",
    icon: Building2,
    children: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/suppliers", label: "Suppliers", icon: Truck },
      { href: "/sponsorship-companies", label: "Sponsorship Companies", icon: Landmark },
      { href: "/sites", label: "Sites", icon: MapPin },
      { href: "/projects", label: "Projects", icon: ClipboardList },
      { href: "/accommodation", label: "Accommodation", icon: BedDouble },
      { href: "/transport", label: "Transport", icon: Bus },
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/banks", label: "Banks", icon: Wallet },
    ],
  },
  {
    type: "group",
    label: "Timesheets",
    icon: FileSpreadsheet,
    children: [
      { href: "/upload", label: "Upload", icon: UploadIcon },
      { href: "/timesheets/manual", label: "Manual Entry", icon: PenSquare },
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

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function groupContainsActive(pathname: string, children: Item[]) {
  return children.some((c) => isActive(pathname, c.href));
}

const ACTIVE_PILL =
  "relative bg-slate-900 text-white before:absolute before:top-1/2 before:left-0 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-green-500";

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const entry of NAV) {
      if (entry.type === "group" && groupContainsActive(pathname, entry.children)) {
        initial.add(entry.label);
      }
    }
    return initial;
  });

  function toggle(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((entry) => {
        if (entry.type === "link") {
          const { href, label, icon: Icon } = entry.item;
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                active
                  ? ACTIVE_PILL
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        }

        const GroupIcon = entry.icon;
        const open = openGroups.has(entry.label);
        const hasActiveChild = groupContainsActive(pathname, entry.children);

        return (
          <div key={entry.label}>
            <button
              type="button"
              onClick={() => toggle(entry.label)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                hasActiveChild
                  ? "text-slate-900"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <GroupIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{entry.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open && (
              <div className="mt-0.5 ml-4 flex flex-col gap-0.5 border-l border-slate-100 pl-3">
                {entry.children.map((child) => {
                  const active = isActive(pathname, child.href);
                  const ChildIcon = child.icon;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                        active
                          ? ACTIVE_PILL
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      }`}
                    >
                      <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {isAdmin && (
        <Link
          href={ADMIN_ITEM.href}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
            isActive(pathname, ADMIN_ITEM.href)
              ? ACTIVE_PILL
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ADMIN_ITEM.icon className="h-4 w-4 shrink-0" />
          {ADMIN_ITEM.label}
        </Link>
      )}
    </nav>
  );
}
