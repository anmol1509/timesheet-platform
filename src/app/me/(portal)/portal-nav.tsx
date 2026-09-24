"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/me", label: "Home", exact: true },
  { href: "/me/payslips", label: "Payslips" },
  { href: "/me/attendance", label: "Attendance" },
  { href: "/me/documents", label: "Documents" },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Portal" className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 pb-2">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm transition",
              active ? "bg-brand-soft font-medium text-[var(--brand-primary)]" : "text-secondary hover:bg-surface-hover"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
