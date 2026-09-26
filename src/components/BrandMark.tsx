"use client";

import Link from "next/link";
import { Building2, Sparkles, ChevronRight } from "lucide-react";
import { BRAND_ICON } from "@/lib/brand-assets";

export type Brand = {
  name: string;
  /** /api/images/<id> URL of the uploaded company logo, or null for the default mark. */
  logoUrl: string | null;
};

/** Product wordmark: the ManpowerSync mark + name. Links to the dashboard. */
export function BrandMark({
  collapsed = false,
  onNavigate,
}: {
  brand?: Brand;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="flex min-w-0 items-center gap-2.5"
      aria-label="ManpowerSync — dashboard"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
      <img src={BRAND_ICON} alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
      {!collapsed && (
        <span className="font-display truncate text-[17px] font-bold tracking-[-0.02em] text-primary">
          Manpower<span className="text-[var(--brand-primary)]">Sync</span>
        </span>
      )}
    </Link>
  );
}

/** The active branch (company) — its uploaded logo, or a tinted building tile. */
export function BranchCard({ brand }: { brand: Brand }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-default bg-surface-subtle px-2.5 py-2">
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, served by our own route
        <img src={brand.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-surface object-contain" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[image:var(--brand-gradient)] text-white shadow-xs">
          <Building2 className="h-4 w-4" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-primary">{brand.name}</span>
        <span className="block truncate text-[11px] text-subtle">Manpower ERP</span>
      </span>
    </div>
  );
}

/** Sidebar footer shortcut into the floating assistant. */
export function AskAiCard() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("open-my-assistant", { detail: {} }))}
      className="group flex w-full items-center gap-3 rounded-xl border border-[var(--brand-primary-border)] bg-brand-soft px-3 py-2.5 text-left transition hover:shadow-sm"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[image:var(--brand-gradient)] text-white shadow-[var(--shadow-brand)]">
        <Sparkles className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-muted">Need help?</span>
        <span className="block truncate text-[13px] font-semibold text-[var(--brand-primary)]">Ask Manpower AI</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--brand-primary)] transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}
