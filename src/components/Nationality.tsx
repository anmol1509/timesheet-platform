import { findCountryByName } from "@/lib/countries";

/** Country flag + name. Free-text values that match no country show as plain text. */
export function Nationality({ name }: { name: string | null | undefined }) {
  if (!name) return <span className="text-subtle">—</span>;
  const country = findCountryByName(name);
  return (
    <span className="inline-flex items-center gap-2">
      {country && <span className={`fi fi-${country.code} shrink-0 rounded-[3px] shadow-xs`} aria-hidden />}
      <span>{name}</span>
    </span>
  );
}
