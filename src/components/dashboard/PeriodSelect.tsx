"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Select";

/** A dropdown that writes one value into the URL query (?period=… or ?month=…), keeping the rest. */
export function QuerySelect({
  param,
  value,
  options,
  width = "w-44",
}: {
  param: string;
  value: string;
  options: { value: string; label: string }[];
  width?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return (
    <div className={width}>
      <Select
        value={value}
        searchable={false}
        triggerClassName="h-9"
        options={options}
        onChange={(v) => {
          const next = new URLSearchParams(search.toString());
          next.set(param, v);
          router.replace(`${pathname}?${next.toString()}`);
        }}
      />
    </div>
  );
}

/**
 * The period dropdown, with two date boxes when "Custom dates" is chosen.
 * Everything lives in the URL (?period=…&from=…&to=…) so a view can be shared.
 */
export function PeriodPicker({
  value,
  from,
  to,
  options,
}: {
  value: string;
  from?: string;
  to?: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;

  function push(mutate: (q: URLSearchParams) => void) {
    const next = new URLSearchParams(search.toString());
    mutate(next);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-44">
        <Select
          value={value}
          searchable={false}
          triggerClassName="h-9"
          options={options}
          onChange={(v) =>
            push((q) => {
              q.set("period", v);
              if (v === "custom") {
                if (!q.get("from")) q.set("from", monthStart);
                if (!q.get("to")) q.set("to", today);
              } else {
                q.delete("from");
                q.delete("to");
              }
            })
          }
        />
      </div>
      {value === "custom" && (
        <>
          <input
            type="date"
            aria-label="From date"
            value={from ?? monthStart}
            max={to ?? today}
            onChange={(e) => e.target.value && push((q) => { q.set("period", "custom"); q.set("from", e.target.value); })}
            className="input h-9 w-36 py-0 text-sm"
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            aria-label="To date"
            value={to ?? today}
            min={from ?? undefined}
            onChange={(e) => e.target.value && push((q) => { q.set("period", "custom"); q.set("to", e.target.value); })}
            className="input h-9 w-36 py-0 text-sm"
          />
        </>
      )}
    </div>
  );
}
