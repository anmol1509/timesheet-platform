import Link from "next/link";
import { BRAND_ICON } from "@/lib/brand-assets";

export type Brand = {
  name: string;
  /** /api/images/<id> URL of the uploaded company logo, or null for the default mark. */
  logoUrl: string | null;
};

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
        // eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed
        <img src={BRAND_ICON} alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
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
