import Link from "next/link";
import { cn } from "@/lib/cn";

export type Brand = {
  name: string;
  /** /api/images/<id> URL of the uploaded company logo, or null for the initials tile. */
  logoUrl: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

/** Sidebar brand block: the company's uploaded logo (or an initials tile) and name. */
export function BrandMark({
  brand,
  collapsed = false,
  onNavigate,
}: {
  brand: Brand;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="flex min-w-0 items-center gap-2.5"
      aria-label={`${brand.name} — dashboard`}
    >
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, served by our own route
        <img
          src={brand.logoUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded-md bg-surface-sunken object-contain"
        />
      ) : (
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-[var(--brand-navy)] text-[11px] font-bold text-white"
          )}
        >
          {initials(brand.name)}
        </span>
      )}
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-primary">{brand.name}</span>
          <span className="block truncate text-[11px] text-subtle">Manpower ERP</span>
        </span>
      )}
    </Link>
  );
}
