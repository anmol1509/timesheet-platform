"use client";

import { useEffect, useState } from "react";
import { Columns3 } from "lucide-react";
import { cn } from "@/lib/cn";

type Option = { key: string; label: string; always?: boolean };

/**
 * "Table columns" for a printed letter: which columns its table prints. The choice is remembered in this browser under
 * `storageKey`, so the next letter of the same kind starts from it.
 */
export function useColumnChoice(storageKey: string, all: string[]): [string[], (next: string[]) => void] {
  const [chosen, setChosen] = useState<string[]>(all);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`letterColumns:${storageKey}`) ?? "null") as string[] | null;
      if (Array.isArray(saved) && saved.length > 0) setChosen(all.filter((k) => saved.includes(k)));
    } catch {
      /* private window or blocked storage: start from every column */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once when the screen opens
  }, [storageKey]);
  const set = (next: string[]) => {
    setChosen(next);
    try { localStorage.setItem(`letterColumns:${storageKey}`, JSON.stringify(next)); } catch { /* not remembered */ }
  };
  return [chosen, set];
}

export function ColumnPicker({ options, value, onChange, className }: { options: Option[]; value: string[]; onChange: (next: string[]) => void; className?: string }) {
  const chosen = new Set(value);
  const toggle = (key: string) => {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(options.filter((o) => o.always || next.has(o.key)).map((o) => o.key));
  };
  const shown = options.filter((o) => o.always || chosen.has(o.key)).length;
  return (
    <details className={cn("relative", className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-control border border-default bg-surface px-3 py-1.5 text-xs font-medium text-secondary hover:bg-surface-hover">
        <Columns3 className="h-3.5 w-3.5" aria-hidden /> Table columns <span className="text-subtle">{shown}/{options.length}</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 grid w-72 grid-cols-2 gap-1 rounded-card border border-default bg-surface p-2 shadow-lg">
        {options.map((o) => (
          <label key={o.key} className={cn("flex items-center gap-2 rounded-md px-2 py-1 text-sm", o.always ? "text-subtle" : "cursor-pointer hover:bg-surface-hover")} title={o.always ? "Always printed" : undefined}>
            <input type="checkbox" checked={o.always || chosen.has(o.key)} disabled={o.always} onChange={() => toggle(o.key)} />
            {o.label}
          </label>
        ))}
      </div>
    </details>
  );
}
