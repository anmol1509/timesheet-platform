"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/cn";

type SearchResults = {
  employees: { id: string; name: string; employeeIdNo: string; trade: string | null }[];
  projects: { id: string; name: string; code: string }[];
  clients: { id: string; name: string; code: string | null }[];
  documents: { id: string; filename: string; type: string; employeeId: string; employee: { name: string } }[];
};

const EMPTY_RESULTS: SearchResults = { employees: [], projects: [], clients: [], documents: [] };

type Flat = { key: string; href: string; group: string; primary: string; secondary?: string };

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    // The spinner is raised inside the timer rather than synchronously here,
    // so a keystroke doesn't cost an extra render before the debounce elapses.
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ⌘K / Ctrl-K focuses search from anywhere in the app.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // One flat list so arrow keys can walk across group boundaries.
  const flat = useMemo<Flat[]>(
    () => [
      ...results.employees.map((e) => ({
        key: `e-${e.id}`,
        href: `/employees/${e.id}`,
        group: "Employees",
        primary: e.name,
        secondary: [e.employeeIdNo, e.trade].filter(Boolean).join(" · "),
      })),
      ...results.projects.map((p) => ({
        key: `p-${p.id}`,
        href: `/projects/${p.id}`,
        group: "Projects",
        primary: p.name,
        secondary: p.code,
      })),
      ...results.clients.map((c) => ({
        key: `c-${c.id}`,
        href: `/clients/${c.id}`,
        group: "Clients",
        primary: c.name,
        secondary: c.code || undefined,
      })),
      ...results.documents.map((d) => ({
        key: `d-${d.id}`,
        href: `/employees/${d.employeeId}`,
        group: "Documents",
        primary: d.filename,
        secondary: `${d.type} · ${d.employee.name}`,
      })),
    ],
    [results]
  );

  // Clamped during render instead of reset in an effect — results shrink as the
  // user types, and the highlight must never point past the end of the list.
  const activeIndex = flat.length === 0 ? 0 : Math.min(highlight, flat.length - 1);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((activeIndex + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((activeIndex - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flat[activeIndex];
      if (target) go(target.href);
    }
  }

  const showPanel = open && query.trim().length >= 2;
  let renderedGroup = "";

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-subtle"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        aria-label="Search employees, projects, clients and documents"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          // Drop stale matches immediately below the 2-char threshold, so
          // clearing and retyping never flashes the previous query's results.
          if (next.trim().length < 2) {
            setResults(EMPTY_RESULTS);
            setHighlight(0);
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search…"
        className="h-9 w-full rounded-control border border-default bg-surface-subtle pr-14 pl-8 text-sm text-primary transition outline-none placeholder:text-subtle hover:bg-surface focus:border-[var(--brand-primary)] focus:bg-surface focus:shadow-[0_0_0_3px_rgb(37_99_235_/_0.12)]"
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-subtle" aria-hidden />
        ) : (
          <kbd className="hidden rounded border border-default bg-surface px-1.5 py-0.5 font-sans text-[10px] font-medium text-subtle sm:block">
            ⌘K
          </kbd>
        )}
      </span>

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute top-full left-0 z-40 mt-1.5 max-h-96 w-full overflow-y-auto rounded-card border border-default bg-surface py-1 shadow-popover"
        >
          {flat.length === 0 && !loading && (
            <p className="px-3.5 py-6 text-center text-sm text-muted">
              No matches for &ldquo;{query}&rdquo;.
            </p>
          )}
          {flat.map((item, i) => {
            const newGroup = item.group !== renderedGroup;
            renderedGroup = item.group;
            return (
              <div key={item.key}>
                {newGroup && (
                  <p className="px-3.5 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                    {item.group}
                  </p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => go(item.href)}
                  className={cn(
                    "flex w-full flex-col items-start px-3.5 py-1.5 text-left transition",
                    i === activeIndex && "bg-surface-hover"
                  )}
                >
                  <span className="truncate text-sm font-medium text-primary">
                    {item.primary}
                  </span>
                  {item.secondary && (
                    <span className="truncate text-xs text-muted">{item.secondary}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
