import type { PassportCheck } from "@/lib/passportMrz";

/** Under a passport expiry date that came from a scan: was it confirmed by the passport's own check digits, or read off the printed page only? */
export function PassportCheckNote({ check, hasExpiry }: { check: PassportCheck | null; hasExpiry: boolean }) {
  if (!check) return null;
  if (check.expiryDropped || !hasExpiry) return <p className="mt-1 text-xs text-[var(--warning)]">Couldn&rsquo;t read the expiry date with confidence. Enter it from the passport.</p>;
  if (check.expiry && hasExpiry) return <p className="mt-1 text-xs text-[var(--success)]">✓ Verified against the passport&rsquo;s machine-readable lines</p>;
  return <p className="mt-1 text-xs text-[var(--warning)]">Read from the printed page only. Please check it against the passport.</p>;
}
