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
  Sparkles,
  Truck,
  UserPlus,
} from "lucide-react";
import { EmployeeAvatar } from "@/components/Avatar";
import { loadQuickViewAction, type QuickView } from "@/app/(platform)/(app)/employees/quick-view";
import { complianceStatus, daysUntil } from "@/lib/compliance";
import { getNavPages } from "@/app/(platform)/(app)/nav-links";
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

type Scope = "all" | "people" | "projects" | "clients" | "suppliers" | "documents" | "actions" | "pages";
/** What a highlighted result stands for, so the preview pane can show it. */
type Entity =
  | { kind: "employee"; id: string; name: string; sub: string; field?: undefined }
  | { kind: "document"; id: string; employeeId: string; name: string; sub: string }
  | { kind: "project" | "client" | "supplier"; id: string; name: string; sub: string; href: string; type: string };

const norm = (v: string) => v.trim().toLowerCase();
const PREVIEW_DOCS = [
  { label: "Visa", field: "visaExpiry" },
  { label: "Labour card", field: "laborCardExpiry" },
  { label: "Medical", field: "medicalExpiry" },
  { label: "Passport", field: "passportExpiry" },
  { label: "Emirates ID", field: "emiratesIdExpiry" },
] as const;

/** Quick-create shortcuts — the "obvious next action" for each module's core
 * task, named directly in the redesign brief's ⌘K spec. Kept static: these
 * are a handful of the app's true entry points, not the whole nav (that's
 * the Pages group). */
const ACTIONS: { href: string; label: string; hint?: string }[] = [
  { href: "/employees/new", label: "Add employee" },
  { href: "/demand/new", label: "Raise demand" },
  { href: "/accommodation/checkin", label: "Check in an employee" },
  { href: "/onboarding/new", label: "Add candidate" },
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
  const [scope, setScope] = useState<Scope>("all");
  const [active, setActive] = useState("");
  const [quick, setQuick] = useState<Record<string, { d: QuickView | null; at: number }>>({});
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
        if (res.ok) {
          const r = (await res.json()) as SearchResults;
          setResults(r);
          // New results arrive after the highlight has already settled on something else (the Ask row); point it at the best record so the preview and Enter act on it.
          const first = r.employees[0] ? `${r.employees[0].name} ${r.employees[0].employeeIdNo} ${r.employees[0].trade ?? ""}` : r.projects[0] ? `${r.projects[0].name} ${r.projects[0].code}` : r.clients[0] ? `${r.clients[0].name} ${r.clients[0].code ?? ""}` : r.suppliers[0] ? `${r.suppliers[0].name} ${r.suppliers[0].code ?? ""}` : r.documents[0] ? `${r.documents[0].filename} ${r.documents[0].employee.name} ${r.documents[0].id}` : null;
          if (first) setActive(first.trim());
        }
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

  // What each highlighted record is, keyed the way cmdk reports the selection.
  const entities = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const e of results.employees) m.set(norm(`${e.name} ${e.employeeIdNo} ${e.trade ?? ""}`), { kind: "employee", id: e.id, name: e.name, sub: [e.employeeIdNo, e.trade].filter(Boolean).join(" · ") });
    for (const d of results.documents) m.set(norm(`${d.filename} ${d.employee.name} ${d.id}`), { kind: "document", id: d.id, employeeId: d.employeeId, name: d.filename, sub: d.employee.name });
    for (const p of results.projects) m.set(norm(`${p.name} ${p.code}`), { kind: "project", id: p.id, name: p.name, sub: [p.code, p.client?.name].filter(Boolean).join(" · "), href: `/projects/${p.id}`, type: "Project" });
    for (const c of results.clients) m.set(norm(`${c.name} ${c.code ?? ""}`), { kind: "client", id: c.id, name: c.name, sub: c.code ?? "", href: `/clients/${c.id}`, type: "Client" });
    for (const sp of results.suppliers) m.set(norm(`${sp.name} ${sp.code ?? ""}`), { kind: "supplier", id: sp.id, name: sp.name, sub: sp.code ?? "", href: `/suppliers/${sp.id}`, type: sp.isOwnCompany ? "Own company" : "Supplier" });
    return m;
  }, [results]);
  const highlighted = entities.get(norm(active));
  const previewEmployeeId = highlighted?.kind === "employee" ? highlighted.id : highlighted?.kind === "document" ? highlighted.employeeId : null;
  useEffect(() => {
    // A preview is reused for half a minute, so stepping back over a person is instant but an edit made meanwhile shows up soon.
    if (!previewEmployeeId || (quick[previewEmployeeId] && Date.now() - quick[previewEmployeeId].at < 30_000)) return;
    let off = false;
    loadQuickViewAction(previewEmployeeId).then((d) => { if (!off) setQuick((q) => ({ ...q, [previewEmployeeId]: { d, at: Date.now() } })); }).catch(() => { if (!off) setQuick((q) => ({ ...q, [previewEmployeeId]: { d: null, at: Date.now() } })); });
    return () => { off = true; };
  }, [previewEmployeeId, quick]);

  const searching = query.trim().length >= 2;
  const chips: { id: Scope; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    ...(searching
      ? ([
          { id: "people", label: "People", count: results.employees.length },
          { id: "projects", label: "Projects", count: results.projects.length },
          { id: "clients", label: "Clients", count: results.clients.length },
          { id: "suppliers", label: "Suppliers", count: results.suppliers.length },
          { id: "documents", label: "Documents", count: results.documents.length },
        ] as { id: Scope; label: string; count: number }[]).filter((c) => c.count > 0)
      : []),
    { id: "actions", label: "Actions" },
    { id: "pages", label: "Pages" },
  ];
  const show = (g: Scope) => scope === "all" || scope === g;
  const wide = searching && !!hasRecords;

  return (
    <>
      <TriggerButton onOpen={openPalette} />
      <Command.Dialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) { setScope("all"); setActive(""); } }}
        value={active}
        onValueChange={setActive}
        label="Command palette"
        overlayClassName="rx-overlay fixed inset-0 z-40 bg-[#101828]/40 backdrop-blur-[2px]"
        contentClassName="rx-palette-host"
        className={cn("rx-palette fixed top-[12%] left-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-[20px] border border-default bg-surface shadow-modal", wide ? "max-w-4xl" : "max-w-xl")}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
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
            style={{ outline: "none", boxShadow: "none", borderColor: "transparent" }}
            className="h-11 w-full bg-transparent text-sm text-primary outline-none placeholder:text-subtle"
          />
          {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-subtle" aria-hidden />}
          <kbd className="hidden shrink-0 rounded border border-default bg-surface-subtle px-1.5 py-0.5 font-sans text-[10px] font-medium text-subtle sm:block">
            Esc
          </kbd>
        </div>
        <div role="tablist" aria-label="Filter results" className="flex flex-wrap gap-1.5 border-b border-default px-3.5 py-2">
          {chips.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={scope === c.id} onClick={() => setScope(c.id)}
              className={cn("rounded-full border px-3 py-1 text-xs transition", scope === c.id ? "border-[var(--brand-primary)] bg-brand-soft font-semibold text-[var(--brand-primary)]" : "border-default text-secondary hover:bg-surface-hover")}>
              {c.label}{c.count !== undefined && <span className="tabular ml-1 opacity-70">{c.count}</span>}
            </button>
          ))}
        </div>
        <div className={cn(wide && "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
        <Command.List className={cn("max-h-[60vh] overflow-y-auto p-1.5", wide && "md:border-r md:border-default")}>
          <Command.Empty className="px-3.5 py-8 text-center text-sm text-muted">
            No matches for &ldquo;{query}&rdquo;.
          </Command.Empty>

          {!query && scope === "all" && recent.length > 0 && (
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

          {hasRecords ? (
            <>
              {show("people") && results.employees.length > 0 && (
                <Command.Group heading="People" className="px-1.5 py-1 text-[10px] font-semibold tracking-wider text-subtle uppercase [&_[cmdk-group-items]]:mt-1">
                  {results.employees.map((e) => (
                    <Item key={`e-${e.id}`} value={`${e.name} ${e.employeeIdNo} ${e.trade ?? ""}`} onSelect={() => go(`/employees?open=${e.id}`, e.name, "Employee")} icon={<EmployeeAvatar employeeId={e.id} name={e.name} hasPhoto={e.hasPhoto} size="sm" />}>
                      <RecordText title={e.name} sub={[e.employeeIdNo, e.trade].filter(Boolean).join(" · ")} type="Employee" />
                    </Item>
                  ))}
                </Command.Group>
              )}
              {show("projects") && results.projects.length > 0 && (
                <Command.Group heading="Projects" className="px-1.5 py-1 text-[10px] font-semibold tracking-wider text-subtle uppercase [&_[cmdk-group-items]]:mt-1">
                  {results.projects.map((p) => (
                    <Item key={`p-${p.id}`} value={`${p.name} ${p.code}`} onSelect={() => go(`/projects/${p.id}`, p.name, "Project")} icon={<RecordIcon icon={FolderKanban} />}>
                      <RecordText title={p.name} sub={[p.code, p.client?.name].filter(Boolean).join(" · ")} type="Project" />
                    </Item>
                  ))}
                </Command.Group>
              )}
              {show("clients") && results.clients.length > 0 && (
                <Command.Group heading="Clients" className="px-1.5 py-1 text-[10px] font-semibold tracking-wider text-subtle uppercase [&_[cmdk-group-items]]:mt-1">
                  {results.clients.map((c) => (
                    <Item key={`c-${c.id}`} value={`${c.name} ${c.code ?? ""}`} onSelect={() => go(`/clients/${c.id}`, c.name, "Client")} icon={<RecordIcon icon={Building2} />}>
                      <RecordText title={c.name} sub={c.code ?? ""} type="Client" />
                    </Item>
                  ))}
                </Command.Group>
              )}
              {show("suppliers") && results.suppliers.length > 0 && (
                <Command.Group heading="Suppliers" className="px-1.5 py-1 text-[10px] font-semibold tracking-wider text-subtle uppercase [&_[cmdk-group-items]]:mt-1">
                  {results.suppliers.map((sp) => (
                    <Item key={`s-${sp.id}`} value={`${sp.name} ${sp.code ?? ""}`} onSelect={() => go(`/suppliers/${sp.id}`, sp.name, "Supplier")} icon={<RecordIcon icon={Truck} />}>
                      <RecordText title={sp.name} sub={sp.code ?? ""} type={sp.isOwnCompany ? "Own company" : "Supplier"} />
                    </Item>
                  ))}
                </Command.Group>
              )}
              {show("documents") && results.documents.length > 0 && (
                <Command.Group heading="Documents" className="px-1.5 py-1 text-[10px] font-semibold tracking-wider text-subtle uppercase [&_[cmdk-group-items]]:mt-1">
                  {results.documents.map((d) => (
                    <Item key={`d-${d.id}`} value={`${d.filename} ${d.employee.name} ${d.id}`} onSelect={() => go(`/employees?open=${d.employeeId}&tab=documents`, d.employee.name, "Employee")} icon={<RecordIcon icon={FileText} />}>
                      <RecordText title={d.filename} sub={d.employee.name} type="Document" />
                    </Item>
                  ))}
                </Command.Group>
              )}
            </>
          ) : query.trim().length >= 2 && !loading ? (
            <p className="px-3.5 py-2 text-xs text-subtle">
              Records search covers employees, projects, clients, suppliers and documents.
            </p>
          ) : null}

          {searching && show("actions") && (
            <Command.Group forceMount heading="Assistant" className="px-1.5 py-1 text-[10px] font-semibold tracking-wider text-subtle uppercase [&_[cmdk-group-items]]:mt-1">
              <Item
                forceMount
                value={`ask assistant ${query}`}
                onSelect={() => { const text = query.trim(); setOpen(false); setQuery(""); window.dispatchEvent(new CustomEvent("open-my-assistant", { detail: { text } })); }}
                icon={<Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary)]" />}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-primary">Ask Assistant</span>
                  <span className="block truncate text-xs text-subtle">&ldquo;{query.trim()}&rdquo;</span>
                </span>
              </Item>
            </Command.Group>
          )}

          {show("actions") && (
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
          )}

          {show("pages") && (
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
          )}

        </Command.List>
        {wide && (
          <aside aria-label="Preview" className="hidden max-h-[60vh] overflow-y-auto p-4 md:block">
            <Preview entity={highlighted} quick={previewEmployeeId ? quick[previewEmployeeId]?.d : undefined} loading={!!previewEmployeeId && !(previewEmployeeId in quick)} onGo={(href, label, group) => go(href, label, group)} />
          </aside>
        )}
        </div>
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
  forceMount,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  icon: React.ReactNode;
  value?: string;
  /** Always listed, and never competes with real matches for the first highlight. */
  forceMount?: boolean;
}) {
  return (
    <Command.Item
      value={value}
      forceMount={forceMount}
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
      className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-default bg-surface/60 px-3 text-sm text-subtle shadow-xs transition hover:border-strong hover:bg-surface hover:text-muted"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate text-left">Search employees, projects, documents, invoices…</span>
      <kbd className="hidden shrink-0 rounded-md border border-default bg-surface px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted shadow-xs sm:block">
        ⌘K
      </kbd>
    </button>
  );
}

function Preview({ entity, quick, loading, onGo }: { entity: Entity | undefined; quick: QuickView | null | undefined; loading: boolean; onGo: (href: string, label: string, group: string) => void }) {
  if (!entity) return <p className="py-10 text-center text-sm text-muted">Move over a result to preview it.</p>;
  if (entity.kind === "project" || entity.kind === "client" || entity.kind === "supplier") {
    return (
      <div>
        <p className="text-[10.5px] font-semibold tracking-wider text-muted uppercase">{entity.type}</p>
        <p className="mt-1 text-base font-semibold text-primary">{entity.name}</p>
        {entity.sub && <p className="text-sm text-muted">{entity.sub}</p>}
        <button type="button" className="btn btn-primary mt-4" onClick={() => onGo(entity.href, entity.name, entity.type)}>Open</button>
      </div>
    );
  }
  if (loading) return <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((n) => <div key={n} className="h-10 animate-pulse rounded-xl bg-surface-sunken" />)}</div>;
  if (!quick) return <p className="py-10 text-center text-sm text-muted">No preview available.</p>;
  const rows = PREVIEW_DOCS.map((d) => {
    const iso = quick.expiry[d.field];
    const status = iso ? complianceStatus(new Date(iso)) : "not_set";
    const days = iso ? daysUntil(new Date(iso)) : null;
    return { ...d, iso, status, days };
  });
  const urgent = rows.filter((r) => r.status === "expired" || r.status === "expiring").sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0];
  const badge = quick.status === "ACTIVE" || quick.status === "IDLE" ? (quick.projectName ? "Deployed" : "On bench") : quick.status.replace(/_/g, " ").toLowerCase();
  return (
    <div>
      <div className="flex items-center gap-3">
        <EmployeeAvatar employeeId={quick.id} name={quick.name} hasPhoto={quick.hasPhoto} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-primary">{quick.name}</p>
          <p className="truncate text-xs text-muted">{[quick.category === "STAFF" ? quick.position : quick.trade, quick.employeeIdNo, quick.nationality].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--info-soft)] px-2.5 py-0.5 text-[10.5px] font-semibold text-[var(--info)] capitalize">{badge}</span>
      </div>
      <dl className="mt-3.5 rounded-[14px] border border-default text-sm">
        {rows.map((r, i) => (
          <div key={r.field} className={cn("flex justify-between gap-3 px-3 py-2", i > 0 && "border-t border-default")}>
            <dt className="text-muted">{r.label}</dt>
            <dd className={cn("tabular font-medium", r.status === "expired" ? "text-[var(--error)]" : r.status === "expiring" ? "text-[var(--warning)]" : r.iso ? "text-primary" : "text-subtle")}>
              {r.iso ? `${new Date(r.iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}${r.status === "expiring" || r.status === "expired" ? ` · ${r.days! < 0 ? `${-r.days!}d ago` : `${r.days}d`}` : ""}` : "Not recorded"}
            </dd>
          </div>
        ))}
      </dl>
      {quick.projectName && <p className="mt-3 text-sm text-muted">Project <b className="ml-1 font-medium text-primary">{quick.projectName}</b></p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onGo(`/employees?open=${quick.id}`, quick.name, "Employee")}>Open quick view</button>
        {urgent && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onGo(`/employees?open=${quick.id}&tab=documents&renew=${urgent.field}`, quick.name, "Employee")}>Renew {urgent.label.toLowerCase()}</button>}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onGo(`/employees/${quick.id}`, quick.name, "Employee")}>Full profile</button>
      </div>
    </div>
  );
}
