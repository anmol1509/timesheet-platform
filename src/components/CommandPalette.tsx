"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  ArrowRight,
  Building2,
  Clock,
  FileText,
  FolderKanban,
  Loader2,
  Search,
  Truck,
  UserPlus,
} from "lucide-react";
import { EmployeeAvatar } from "@/components/Avatar";
import { getNavPages } from "@/app/(app)/nav-links";
import { cn } from "@/lib/cn";
import { moduleForPath } from "@/lib/permissions";

type SearchResults = {
  employees: { id: string; name: string; employeeIdNo: string; trade: string | null; hasPhoto: boolean }[];
  projects: { id: string; name: string; code: string; client: { name: string } | null }[];
  clients: { id: string; name: string; code: string | null }[];
  suppliers: { id: string; name: string; code: string | null; isOwnCompany: boolean }[];
  documents: { id: string; filename: string; type: string; employeeId: string; employee: { name: string } }[];
};

const EMPTY_RESULTS: SearchResults = { employees: [], projects: [], clients: [], suppliers: [], documents: [] };

const RECENT_KEY = "nav-recent-pages";
const RECENT_MAX = 8;

type RecentEntry = { href: string; label: string; group: string };

/** Quick-create shortcuts — the "obvious next action" for each module's core
 * task, named directly in the redesign brief's ⌘K spec. Kept static: these
 * are a handful of the app's true entry points, not the whole nav (that's
 * the Pages group). */
const ACTIONS: { href: string; label: string; hint?: string }[] = [
  { href: "/employees/new", label: "Add employee" },
  { href: "/demand/new", label: "Raise demand" },
  { href: "/accommodation/checkin", label: "Check in an employee" },
  { href: "/invoices/client-timesheet/new", label: "New timesheet entry" },
  { href: "/invoices", label: "Generate an invoice" },
  { href: "/operations/nocs/new", label: "Issue a NOC" },
  { href: "/clients/new", label: "New client" },
  { href: "/projects/new", label: "New project" },
  { href: "/sales/quotations/new", label: "New quotation" },
  { href: "/transport/routes/new", label: "New route" },
];

function readRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Was a bare string[] of hrefs before this fix — only resolvable against
    // the static Pages list, so visiting a record (the common case, reached
    // via search) never actually showed up here. Drop anything in the old
    // shape rather than crash rendering it.
    if (!Array.isArray(parsed) || (parsed.length > 0 && typeof parsed[0] === "string")) return [];
    return parsed as RecentEntry[];
  } catch {
    return [];
  }
}

function pushRecent(entry: RecentEntry) {
  try {
    const next = [entry, ...readRecent().filter((e) => e.href !== entry.href)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private window / blocked storage — recents just won't persist. Not
    // worth surfacing to the user for a convenience feature.
  }
}

/**
 * ⌘K command palette. Four groups: Pages (every sidebar destination — see
 * getNavPages), Actions (the app's core "create" shortcuts), Recent (last 8
 * pages visited, per-browser via localStorage — a convenience, never read
 * back for anything that matters), and Records (the existing employee/
 * project/client/document search API, unchanged — widening it to suppliers/
 * demands/camps/invoices needs a decision from the Phase 0 audit's list and
 * hasn't been made yet).
 */
export function CommandPalette({
  isAdmin,
  isSuperAdmin,
  allowedModules = null,
}: {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  allowedModules?: string[] | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const router = useRouter();
  const pages = useMemo(() => getNavPages(isAdmin, isSuperAdmin, allowedModules), [isAdmin, isSuperAdmin, allowedModules]);

  // Recents are read on the way *in* (the trigger click, or ⌘K's keydown
  // callback) rather than via an effect keyed on `open` — both are already
  // event-handler callbacks, so the state update happens in response to a
  // real event instead of synchronously inside an effect body.
  function openPalette() {
    setRecent(readRecent());
    setOpen(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => {
          const next = !prev;
          if (next) setRecent(readRecent());
          return next;
        });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    // Below the threshold there's nothing to fetch — the input's own
    // onValueChange already clears `results` synchronously when the user
    // shortens the query, so this effect doesn't need to touch state here.
    if (q.length < 2) return;
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

  function go(href: string, label: string, group: string) {
    pushRecent({ href, label, group });
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const hasRecords =
    results.employees.length ||
    results.projects.length ||
    results.clients.length ||
    results.suppliers.length ||
    results.documents.length;

  return (
    <>
      <TriggerButton onOpen={openPalette} />
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command palette"
        className="rx-content fixed top-[12%] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-default bg-surface shadow-modal"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <ShieldOverlay onClose={() => setOpen(false)} />
        <div className="flex items-center gap-2.5 border-b border-default px-3.5">
          <Search className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
          <Command.Input
            value={query}
            onValueChange={(next) => {
              setQuery(next);
              if (next.trim().length < 2) setResults(EMPTY_RESULTS);
            }}
            autoFocus
            placeholder="Search pages, records or actions…"
            className="h-11 w-full bg-transparent text-sm text-primary outline-none placeholder:text-subtle"
          />
          {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-subtle" aria-hidden />}
          <kbd className="hidden shrink-0 rounded border border-default bg-surface-subtle px-1.5 py-0.5 font-sans text-[10px] font-medium text-subtle sm:block">
            Esc
          </kbd>
        </div>
        <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
          <Command.Empty className="px-3.5 py-8 text-center text-sm text-muted">
            No matches for &ldquo;{query}&rdquo;.
          </Command.Empty>

          {!query && recent.length > 0 && (
            <Command.Group
              heading="Recent"
              className="px-1.5 py-1 text-[10px] font-semibold tracking-wider text-subtle uppercase [&_[cmdk-group-items]]:mt-1"
            >
              {recent.map((r) => (
                <Item
                  key={`recent-${r.href}`}
                  value={`recent ${r.label} ${r.group}`}
                  onSelect={() => go(r.href, r.label, r.group)}
                  icon={<Clock className="h-3.5 w-3.5" />}
                >
                  <span className="truncate">{r.label}</span>
                  <span className="ml-auto shrink-0 text-xs text-subtle">{r.group}</span>
                </Item>
              ))}
            </Command.Group>
          )}

          <Command.Group
            heading="Actions"
            className="px-1.5 py-1 text-[10px] font-semibold tracking-wider text-subtle uppercase [&_[cmdk-group-items]]:mt-1"
          >
            {ACTIONS.filter((a) => {
              const m = moduleForPath(a.href);
              return !m || !allowedModules || allowedModules.includes(m);
            }).map((a) => (
              <Item key={a.href} onSelect={() => go(a.href, a.label, "Action")} icon={<UserPlus className="h-3.5 w-3.5" />}>
                {a.label}
              </Item>
            ))}
          </Command.Group>

          <Command.Group
            heading="Pages"
            className="px-1.5 py-1 text-[10px] font-semibold tracking-wider text-subtle uppercase [&_[cmdk-group-items]]:mt-1"
          >
            {pages.map((p) => {
              const Icon = p.icon;
              return (
                <Item key={p.href} value={`${p.label} ${p.group}`} onSelect={() => go(p.href, p.label, p.group)} icon={<Icon className="h-3.5 w-3.5" />}>
                  <span className="truncate">{p.label}</span>
                  <span className="ml-auto shrink-0 text-xs text-subtle">{p.group}</span>
                </Item>
              );
            })}
          </Command.Group>

          {hasRecords ? (
            <Command.Group
              heading="Records"
              className="px-1.5 py-1 text-[10px] font-semibold tracking-wider text-subtle uppercase [&_[cmdk-group-items]]:mt-1"
            >
              {results.employees.map((e) => (
                <Item key={`e-${e.id}`} value={`${e.name} ${e.employeeIdNo} ${e.trade ?? ""}`} onSelect={() => go(`/employees/${e.id}`, e.name, "Employee")} icon={<EmployeeAvatar employeeId={e.id} name={e.name} hasPhoto={e.hasPhoto} size="sm" />}>
                  <RecordText title={e.name} sub={[e.employeeIdNo, e.trade].filter(Boolean).join(" · ")} type="Employee" />
                </Item>
              ))}
              {results.projects.map((p) => (
                <Item key={`p-${p.id}`} value={`${p.name} ${p.code}`} onSelect={() => go(`/projects/${p.id}`, p.name, "Project")} icon={<RecordIcon icon={FolderKanban} />}>
                  <RecordText title={p.name} sub={[p.code, p.client?.name].filter(Boolean).join(" · ")} type="Project" />
                </Item>
              ))}
              {results.clients.map((c) => (
                <Item key={`c-${c.id}`} value={`${c.name} ${c.code ?? ""}`} onSelect={() => go(`/clients/${c.id}`, c.name, "Client")} icon={<RecordIcon icon={Building2} />}>
                  <RecordText title={c.name} sub={c.code ?? ""} type="Client" />
                </Item>
              ))}
              {results.suppliers.map((sp) => (
                <Item key={`s-${sp.id}`} value={`${sp.name} ${sp.code ?? ""}`} onSelect={() => go(`/suppliers/${sp.id}`, sp.name, "Supplier")} icon={<RecordIcon icon={Truck} />}>
                  <RecordText title={sp.name} sub={sp.code ?? ""} type={sp.isOwnCompany ? "Own company" : "Supplier"} />
                </Item>
              ))}
              {results.documents.map((d) => (
                <Item key={`d-${d.id}`} value={`${d.filename} ${d.employee.name}`} onSelect={() => go(`/employees/${d.employeeId}`, d.employee.name, "Employee")} icon={<RecordIcon icon={FileText} />}>
                  <RecordText title={d.filename} sub={d.employee.name} type="Document" />
                </Item>
              ))}
            </Command.Group>
          ) : query.trim().length >= 2 && !loading ? (
            <p className="px-3.5 py-2 text-xs text-subtle">
              Records search covers employees, projects, clients, suppliers and documents.
            </p>
          ) : null}
        </Command.List>
        <div className="flex items-center gap-3 border-t border-default bg-surface-subtle px-3.5 py-2 text-[11px] text-subtle">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-default bg-surface px-1 py-0.5 font-sans">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-default bg-surface px-1 py-0.5 font-sans">↵</kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1">
            press <kbd className="rounded border border-default bg-surface px-1 py-0.5 font-sans">?</kbd> for all shortcuts
          </span>
        </div>
      </Command.Dialog>
    </>
  );
}

function Item({
  children,
  onSelect,
  icon,
  value,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  icon: React.ReactNode;
  value?: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-secondary transition-colors normal-case tracking-normal",
        "data-[selected=true]:bg-brand-soft data-[selected=true]:text-primary"
      )}
    >
      <span className="shrink-0 text-subtle">{icon}</span>
      {children}
      <ArrowRight className="ml-1 hidden h-3 w-3 shrink-0 text-subtle group-data-[selected=true]:block" aria-hidden />
    </Command.Item>
  );
}

function RecordIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-sunken text-muted group-data-[selected=true]:bg-surface group-data-[selected=true]:text-[var(--brand-primary)]">
      <Icon className="h-4 w-4" />
    </span>
  );
}

function RecordText({ title, sub, type }: { title: string; sub: string; type: string }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-primary">{title}</span>
        {sub && <span className="block truncate text-xs text-subtle">{sub}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[10.5px] font-medium text-muted">{type}</span>
    </>
  );
}

/** Dims the page behind the palette — cmdk's Dialog doesn't ship its own
 * overlay, so this mirrors the one in ui/Dialog.tsx. */
function ShieldOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="rx-overlay fixed inset-0 -z-10 bg-[#101828]/40 backdrop-blur-[2px]"
      style={{ position: "fixed", inset: 0 }}
      onClick={onClose}
      aria-hidden
    />
  );
}

/**
 * The header widget people actually see — a button, not a live input,
 * because the real typing now happens inside the modal (clicking to open
 * a centered palette reads calmer than an inline dropdown growing under a
 * corner search box). Opens on click or focus (tab into it), same as ⌘K.
 */
function TriggerButton({ onOpen }: { onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-label="Open command palette (⌘K)"
      className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-default bg-surface-subtle px-3 text-sm text-subtle shadow-xs transition hover:border-strong hover:bg-surface hover:text-muted"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate text-left">Search employees, projects, documents, invoices…</span>
      <kbd className="hidden shrink-0 rounded-md border border-default bg-surface px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted shadow-xs sm:block">
        ⌘K
      </kbd>
    </button>
  );
}
