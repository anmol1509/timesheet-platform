"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";

/**
 * A search box over a table that a server page has already rendered: rows that don't contain the text are hidden, so
 * a long list can be narrowed without turning the page into a client component.
 */
export function TableSearch({ placeholder = "Search…", children }: { placeholder?: string; children: React.ReactNode }) {
  const body = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<number | null>(null);

  function filter(value: string) {
    const q = value.trim().toLowerCase();
    const rows = Array.from(body.current?.querySelectorAll<HTMLTableRowElement>("tbody tr") ?? []);
    let visible = 0;
    for (const row of rows) {
      const match = !q || (row.textContent ?? "").toLowerCase().includes(q);
      row.hidden = !match;
      if (match) visible++;
    }
    setShown(q ? visible : null);
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          type="search"
          onChange={(e) => filter(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-control border border-default bg-surface py-2 pr-3 pl-9 text-sm"
        />
      </div>
      <div ref={body}>{children}</div>
      {shown === 0 && <p className="text-center text-sm text-muted">Nothing matches that search.</p>}
    </div>
  );
}
