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
