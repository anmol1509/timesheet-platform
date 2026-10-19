import Link from "next/link";
import { Bell, KeyRound, Laptop, Palette, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

export const ACCOUNT_TABS = [
  { key: "profile", label: "Profile", icon: UserRound },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security", icon: KeyRound },
  { key: "devices", label: "Sessions & devices", icon: Laptop },
] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number]["key"];

/** The list of My account sections: a column on wide screens, a scrolling row on narrow ones. */
export function AccountRail({ active }: { active: AccountTab }) {
  return (
    <nav aria-label="My account" className="card flex shrink-0 gap-1 overflow-x-auto p-2 lg:w-56 lg:flex-col lg:overflow-visible">
      {ACCOUNT_TABS.map(({ key, label, icon: Icon }) => (
        <Link
          key={key}
          href={`/profile?tab=${key}`}
          aria-current={active === key ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition",
            active === key ? "bg-brand-soft font-semibold text-brand" : "text-secondary hover:bg-surface-hover hover:text-primary",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
