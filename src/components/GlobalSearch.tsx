"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type SearchResults = {
  employees: { id: string; name: string; employeeIdNo: string; trade: string | null }[];
  projects: { id: string; name: string; code: string }[];
  clients: { id: string; name: string; code: string | null }[];
  documents: { id: string; filename: string; type: string; employeeId: string; employee: { name: string } }[];
};

const EMPTY_RESULTS: SearchResults = { employees: [], projects: [], clients: [], documents: [] };

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY_RESULTS);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
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

  const hasResults =
    results.employees.length > 0 ||
    results.projects.length > 0 ||
    results.clients.length > 0 ||
    results.documents.length > 0;

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div ref={containerRef} className="relative max-w-md flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search employees, projects, or documents..."
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-700 outline-none focus:border-slate-400"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 z-20 mt-1 w-full max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {!hasResults && (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              No matches for &quot;{query}&quot;.
            </p>
          )}
          {results.employees.length > 0 && (
            <SearchGroup label="Employees">
              {results.employees.map((e) => (
                <SearchRow
                  key={e.id}
                  onClick={() => go(`/employees/${e.id}`)}
                  primary={e.name}
                  secondary={[e.employeeIdNo, e.trade].filter(Boolean).join(" · ")}
                />
              ))}
            </SearchGroup>
          )}
          {results.projects.length > 0 && (
            <SearchGroup label="Projects">
              {results.projects.map((p) => (
                <SearchRow
                  key={p.id}
                  onClick={() => go(`/projects/${p.id}`)}
                  primary={p.name}
                  secondary={p.code}
                />
              ))}
            </SearchGroup>
          )}
          {results.clients.length > 0 && (
            <SearchGroup label="Clients">
              {results.clients.map((c) => (
                <SearchRow
                  key={c.id}
                  onClick={() => go(`/clients/${c.id}`)}
                  primary={c.name}
                  secondary={c.code || undefined}
                />
              ))}
            </SearchGroup>
          )}
          {results.documents.length > 0 && (
            <SearchGroup label="Documents">
              {results.documents.map((d) => (
                <SearchRow
                  key={d.id}
                  onClick={() => go(`/employees/${d.employeeId}`)}
                  primary={d.filename}
                  secondary={`${d.type} · ${d.employee.name}`}
                />
              ))}
            </SearchGroup>
          )}
        </div>
      )}
    </div>
  );
}

function SearchGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-1.5 last:border-0">
      <p className="px-4 pt-1 pb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function SearchRow({
  primary,
  secondary,
  onClick,
}: {
  primary: string;
  secondary?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-slate-50"
    >
      <span className="text-sm font-medium text-slate-900">{primary}</span>
      {secondary && <span className="text-xs text-slate-500">{secondary}</span>}
    </button>
  );
}
