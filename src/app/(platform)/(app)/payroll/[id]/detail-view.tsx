"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

type Chip = "all" | "fix" | "pending" | "paid";

/**
 * Wraps the pay table. Simple by default: name, earnings, deductions, net. "Show every column" reveals the working
 * (base, overtime, absences...); cells marked data-detail are hidden until it is on. Search and the chips narrow the
 * rows by what each row says about itself (data-name, data-bank, data-pay), so a 200-worker run is findable.
 */
export function DetailView({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<Chip>("all");
  const [counts, setCounts] = useState({ all: 0, fix: 0, pending: 0, paid: 0 });
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rows = [...(root.current?.querySelectorAll<HTMLTableRowElement>("tbody tr[data-name]") ?? [])];
    const q = query.trim().toLowerCase();
    const next = { all: rows.length, fix: 0, pending: 0, paid: 0 };
    for (const r of rows) {
      const fix = r.dataset.bank === "fix", pending = r.dataset.pay === "PENDING", paid = r.dataset.pay === "PAID";
      if (fix) next.fix++;
      if (pending) next.pending++;
      if (paid) next.paid++;
      const matchesChip = chip === "all" || (chip === "fix" && fix) || (chip === "pending" && pending) || (chip === "paid" && paid);
      r.style.display = matchesChip && (!q || (r.dataset.name ?? "").includes(q)) ? "" : "none";
    }
    setCounts((c) => (c.all === next.all && c.fix === next.fix && c.pending === next.pending && c.paid === next.paid ? c : next));
  }, [query, chip, children]);

  const chips: [Chip, string, number][] = [["all", "All", counts.all], ["fix", "Needs fixing", counts.fix], ["pending", "Awaiting bank", counts.pending], ["paid", "Paid", counts.paid]];
  return (
    <div className="group" data-detail={on ? "on" : "off"} ref={root}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search worker…" aria-label="Search workers in this run" className="input w-full pl-9" />
        </label>
        {chips.filter(([key, , n]) => key === "all" || n > 0).map(([key, label, n]) => (
          <button key={key} type="button" onClick={() => setChip(key)} className={cn("rounded-control border px-3 py-1.5 text-xs font-medium transition", chip === key ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default bg-surface text-secondary hover:bg-surface-hover")}>{label} ({n})</button>
        ))}
        <span className="flex-1" />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-secondary">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-3.5 w-3.5" />
          Show every column (base, overtime, absences…)
        </label>
      </div>
      {children}
    </div>
  );
}
