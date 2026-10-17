"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, ChevronRight, Printer, Search, Star, X } from "lucide-react";
import { EmployeeAvatar } from "@/components/Avatar";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { ScanUpload } from "@/app/(platform)/(app)/employees/scan-upload";
import { cn } from "@/lib/cn";
import { deleteDocumentsAction } from "./actions";
import { Preview, typeLabel, type DocRow } from "./document-browser";
import { MATRIX_LABEL, MATRIX_TYPES, badness, buildCells, completeCount, employeePrintIds, policiesBySupplier, supplierWcCell, type Cell, type CellState, type MatrixEmployee, type MatrixType, type Policy, type PrintKind } from "./matrix";
import type { CompanyAttachment, CompanySupplier } from "./company-docs";
import { PrintDialog } from "./print-dialog";
import { printDocuments } from "./print-docs";
import { SupplierDocsView } from "./supplier-docs-view";

type View = "employee" | "supplier";
type Chip = "all" | "expired" | "expiring" | "missing" | "complete";
type Sort = "worst" | "name";
type SavedView = { name: string; view: View; chip: Chip; query: string; supplierIds: string[]; project: string; sort: Sort };

const BUILT_IN: SavedView[] = [
  { name: "Expired anything", view: "employee", chip: "expired", query: "", supplierIds: [], project: "", sort: "worst" },
  { name: "Missing documents", view: "employee", chip: "missing", query: "", supplierIds: [], project: "", sort: "worst" },
  { name: "Expiring in 30 days", view: "employee", chip: "expiring", query: "", supplierIds: [], project: "", sort: "worst" },
  { name: "Suppliers with expired", view: "supplier", chip: "expired", query: "", supplierIds: [], project: "", sort: "worst" },
];
const STORE = "documents-saved-views-v1";

const TONE: Record<CellState, string> = {
  valid: "bg-[var(--success-soft)] text-[var(--success)] border-transparent",
  expiring: "bg-[var(--warning-soft)] text-[var(--warning)] border-transparent",
  expired: "bg-[var(--error-soft)] text-[var(--error)] border-transparent",
  missing: "border-dashed border-[var(--border-strong,var(--border))] text-subtle",
  notlisted: "border-dashed border-[var(--warning)] text-[var(--warning)]",
};

function CellBox({ cell, label, onClick }: { cell: Cell; label: string; onClick?: () => void }) {
  const inner = (<><span className="block text-[11px] font-semibold">{cell.label}</span><span className="block text-[10px] opacity-80">{cell.sub}</span></>);
  const cls = cn("inline-flex min-w-[4.75rem] flex-col items-center rounded-[10px] border px-2 py-1 leading-tight", TONE[cell.state], onClick && "cursor-pointer hover:brightness-95");
  return onClick ? <button type="button" aria-label={`${label}: ${cell.label}, ${cell.sub}`} onClick={onClick} className={cls}>{inner}</button> : <span className={cls} aria-label={`${label}: ${cell.label}, ${cell.sub}`}>{inner}</span>;
}

export function MatrixViews({ view, documents, employees, policies, companySuppliers, companyAttachments, certsInUse, suppliers, projects }: {
  view: View;
  documents: DocRow[];
  employees: (MatrixEmployee & { projectName: string | null })[];
  policies: Policy[];
  companySuppliers: CompanySupplier[];
  companyAttachments: CompanyAttachment[];
  certsInUse: string[];
  suppliers: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [project, setProject] = useState("");
  const [chip, setChip] = useState<Chip>("all");
  const [sort, setSort] = useState<Sort>("worst");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<{ supplierId: string; type: MatrixType | "WC" } | null>(null);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [uploadFor, setUploadFor] = useState<{ employee: MatrixEmployee; type: MatrixType } | null>(null);
  const [saved, setSaved] = useState<SavedView[]>([]);
  const [applied, setApplied] = useState<SavedView | null>(null);
  const [sub, setSub] = useState<"company" | "workers">("company");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem(STORE) || "[]")); } catch { /* private window: no saved views */ }
  }, []);
  const persist = (next: SavedView[]) => { setSaved(next); try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* ignore */ } };

  const { cells, coverageKnown } = useMemo(() => buildCells(employees, documents, policies, now), [employees, documents, policies, now]);
  const policiesBy = useMemo(() => policiesBySupplier(policies), [policies]);

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) =>
      (supplierIds.length === 0 || (e.supplierId && supplierIds.includes(e.supplierId))) &&
      (!project || e.projectId === project) &&
      (!q || `${e.name} ${e.employeeIdNo} ${e.supplierName ?? ""}`.toLowerCase().includes(q))
    );
  }, [employees, query, supplierIds, project]);

  const matches = (id: string, c: Chip) => {
    const row = cells.get(id)!;
    const states = MATRIX_TYPES.map((t) => row[t].state);
    switch (c) {
      case "all": return true;
      case "expired": return states.includes("expired");
      case "expiring": return states.includes("expiring");
      case "missing": return states.includes("missing");
      case "complete": return completeCount(row) === 5;
    }
  };
  const countFor = (c: Chip) => base.filter((e) => matches(e.id, c)).length;

  const rows = useMemo(() => {
    const list = base.filter((e) => matches(e.id, chip));
    return [...list].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : badness(cells.get(b.id)!) - badness(cells.get(a.id)!) || a.name.localeCompare(b.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, chip, sort, cells]);

  const chosen = rows.filter((e) => selected.has(e.id));
  const allRowsOn = rows.length > 0 && rows.every((e) => selected.has(e.id));
  const someRowsOn = rows.some((e) => selected.has(e.id));
  const toggleRow = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const printCount = (kinds: string[]) => { const r = employeePrintIds(chosen.map((e) => e.id), kinds as PrintKind[], cells); return { printing: r.ids.length, missing: r.missing }; };
  const printOptions = [...MATRIX_TYPES, "WC" as const].map((t) => {
    const have = t === "WC" ? chosen.filter((e) => cells.get(e.id)!.WC.attachmentId).length : chosen.filter((e) => cells.get(e.id)![t].docId).length;
    return { key: t as string, label: t === "WC" ? "Workmen comp certificate" : MATRIX_LABEL[t], have, of: chosen.length, note: t === "WC" ? "each worker's own certificate" : undefined };
  });

  type Group = { id: string; name: string; workers: typeof base; counts: Record<MatrixType, Record<CellState, number>>; complete: number; wc: { cell: Cell; policies: number } };
  const groups = useMemo<Group[]>(() => {
    const by = new Map<string, typeof base>();
    for (const e of base) by.set(e.supplierId ?? "none", [...(by.get(e.supplierId ?? "none") ?? []), e]);
    return [...by.entries()].map(([id, workers]) => {
      const counts = Object.fromEntries(MATRIX_TYPES.map((t) => [t, { valid: 0, expiring: 0, expired: 0, missing: 0, notlisted: 0 }])) as Group["counts"];
      let complete = 0;
      for (const w of workers) {
        const row = cells.get(w.id)!;
        for (const t of MATRIX_TYPES) counts[t][row[t].state]++;
        complete += completeCount(row);
      }
      return { id, name: workers[0].supplierName ?? "No supplier", workers, counts, complete, wc: supplierWcCell(workers.map((w) => cells.get(w.id)!.WC), policiesBy.get(id) ?? [], now) };
    });
  }, [base, cells, policiesBy, now]);
  const groupMatches = (g: Group, c: Chip) => c === "all" || (c === "expired" && MATRIX_TYPES.some((t) => g.counts[t].expired > 0)) || (c === "expiring" && MATRIX_TYPES.some((t) => g.counts[t].expiring > 0)) || (c === "missing" && MATRIX_TYPES.some((t) => g.counts[t].missing > 0)) || (c === "complete" && g.complete === g.workers.length * 5);
  const pct = (g: Group) => (g.workers.length ? g.complete / (g.workers.length * 5) : 1);
  const shownGroups = groups.filter((g) => groupMatches(g, chip)).sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : pct(a) - pct(b) || a.name.localeCompare(b.name)));

  const docById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents]);
  const orderForPreview = openDoc ? [...documents].filter((d) => d.employeeId === docById.get(openDoc)?.employeeId).map((d) => d.id) : [];
  const current = openDoc ? docById.get(openDoc) ?? null : null;
  const idx = current ? orderForPreview.indexOf(current.id) : -1;

  function applyView(v: SavedView) {
    setQuery(v.query); setSupplierIds(v.supplierIds); setProject(v.project); setChip(v.chip); setSort(v.sort); setApplied(v);
  }

  function clickCell(e: MatrixEmployee, type: MatrixType | "WC", cell: Cell) {
    if (type === "WC") { if (e.supplierId) router.push(`/suppliers/${e.supplierId}`); return; }
    if (cell.docId) setOpenDoc(cell.docId);
    else setUploadFor({ employee: e, type });
  }

  function printSupplierReport() {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const head = [...MATRIX_TYPES.map((t) => MATRIX_LABEL[t]), "Workmen comp"].map((h) => `<th>${h}</th>`).join("");
    const body = shownGroups.map((g) => {
      const cols = MATRIX_TYPES.map((t) => { const c = g.counts[t]; return `<td>${c.valid + c.expiring}/${g.workers.length} ok${c.expired ? `<br><b style="color:#b91c1c">${c.expired} expired</b>` : ""}${c.missing ? `<br>${c.missing} missing` : ""}</td>`; }).join("");
      const wc = g.wc.policies === 0 ? "No policy" : `${g.wc.cell.label}${g.wc.policies > 1 ? ` · ${g.wc.policies} policies` : ` · ${g.wc.cell.sub}`}`;
      return `<tr><td><b>${esc(g.name)}</b><br><small>${g.workers.length} workers · ${Math.round(pct(g) * 100)}% complete</small></td>${cols}<td>${esc(wc)}</td></tr>`;
    }).join("");
    w.document.write(`<!doctype html><title>Documents by supplier</title><style>body{font:13px system-ui,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 14px;color:#555}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#666}small{color:#777}</style><h1>Documents by supplier</h1><p>${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p><table><thead><tr><th>Supplier</th>${head}</tr></thead><tbody>${body}</tbody></table>`);
    w.document.close(); w.focus(); w.print();
  }

  const chips: [Chip, string][] = view === "employee"
    ? [["all", "Everyone"], ["expired", "Anything expired"], ["expiring", "Expiring soon"], ["missing", "Missing something"], ["complete", "Complete"]]
    : [["all", "All suppliers"], ["expired", "With expired"], ["missing", "With missing"], ["complete", "All complete"]];
  const chipCount = (c: Chip) => (view === "employee" ? countFor(c) : groups.filter((g) => groupMatches(g, c)).length);

  const Worker = ({ e, indent, selectable }: { e: (typeof base)[number]; indent?: boolean; selectable?: boolean }) => {
    const row = cells.get(e.id)!;
    return (
      <tr className={cn("border-t border-default", selectable && selected.has(e.id) && "bg-brand-soft")}>
        {selectable && <td className="w-10 px-4 py-2.5"><Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggleRow(e.id)} ariaLabel={`Select ${e.name}`} /></td>}
        <td className={cn("px-4 py-2.5", indent && "pl-11")}>
          <span className="flex items-center gap-2.5">
            <EmployeeAvatar employeeId={e.id} name={e.name} hasPhoto={e.hasPhoto} size="sm" />
            <span className="min-w-0"><Link href={`/employees/${e.id}`} className="block truncate font-medium text-primary hover:underline">{e.name}</Link><span className="text-xs text-subtle">{e.employeeIdNo}{view === "employee" && e.supplierName ? ` · ${e.supplierName}` : ""}</span></span>
          </span>
        </td>
        {[...MATRIX_TYPES, "WC" as const].map((t) => (
          <td key={t} className="px-1.5 py-2"><CellBox cell={row[t]} label={`${e.name} ${MATRIX_LABEL[t]}`} onClick={() => clickCell(e, t, row[t])} /></td>
        ))}
        <td className="px-4 py-2.5 text-right tabular text-secondary"><b>{completeCount(row)}</b> of 5</td>
      </tr>
    );
  };
  const thead = (first: string, selectAll?: boolean) => (
    <thead className="bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
      <tr>{selectAll && <th className="w-10 px-4 py-3"><Checkbox checked={allRowsOn} indeterminate={!allRowsOn && someRowsOn} onCheckedChange={(on) => setSelected(on ? new Set(rows.map((e) => e.id)) : new Set())} ariaLabel="Select everyone shown" /></th>}<th className="px-4 py-3">{first}</th>{[...MATRIX_TYPES, "WC" as const].map((t) => <th key={t} className="px-2 py-3">{MATRIX_LABEL[t]}</th>)}<th className="px-4 py-3 text-right">{view === "employee" ? "Complete" : "Overall"}</th></tr>
    </thead>
  );

  const subToggle = view === "supplier" && (
    <div className="inline-flex overflow-hidden rounded-control border border-default" role="group" aria-label="What to show for each supplier">
      {([["company", "Company documents"], ["workers", "Workers' documents"]] as const).map(([key, label]) => (
        <button key={key} type="button" aria-pressed={sub === key} onClick={() => setSub(key)} className={cn("px-3.5 py-1.5 text-xs font-medium transition", sub === key ? "bg-brand-soft text-[var(--brand-primary)]" : "bg-surface text-secondary hover:bg-surface-hover")}>{label}</button>
      ))}
    </div>
  );
  if (view === "supplier" && sub === "company") {
    return (
      <div className="space-y-3">
        {subToggle}
        <SupplierDocsView suppliers={companySuppliers} attachments={companyAttachments} certsInUse={certsInUse} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {subToggle}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={view === "employee" ? "Search employee or ID…" : "Search supplier or worker…"} aria-label="Search" className="input w-full pl-9" />
        </label>
        {view === "employee" && <div className="w-52"><MultiSelect values={supplierIds} onChange={setSupplierIds} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} noun="suppliers" placeholder="All suppliers" /></div>}
        <div className="w-52"><Select value={project} onChange={setProject} placeholder="All projects" options={[{ value: "", label: "All projects" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} /></div>
        <ViewsMenu saved={saved} applied={applied} onApply={applyView} onSave={(name) => { const v: SavedView = { name, view, chip, query, supplierIds, project, sort }; persist([...saved.filter((s) => s.name !== name), v]); setApplied(v); }} onDelete={(name) => persist(saved.filter((s) => s.name !== name))} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setChip(key)} className={cn("rounded-control border px-3 py-1.5 text-xs font-medium transition", chip === key ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default bg-surface text-secondary hover:bg-surface-hover")}>{label} ({chipCount(key)})</button>
        ))}
        <span className="flex-1" />
        <div className="w-44"><Select value={sort} onChange={(v) => setSort(v as Sort)} searchable={false} options={[{ value: "worst", label: view === "employee" ? "Worst first" : "Least complete first" }, { value: "name", label: "Name A–Z" }]} /></div>
        {view === "employee" && <button type="button" onClick={() => setPrinting(true)} disabled={chosen.length === 0} title={chosen.length === 0 ? "Tick the workers to print first" : undefined} className="btn btn-secondary gap-1.5"><Printer className="h-4 w-4" aria-hidden />Print…</button>}
        {view === "supplier" && <button type="button" onClick={printSupplierReport} className="btn btn-secondary gap-1.5"><Printer className="h-4 w-4" aria-hidden />Print supplier report</button>}
      </div>

      {view === "employee" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            {thead("Employee", true)}
            <tbody>{rows.slice(0, 100).map((e) => <Worker key={e.id} e={e} selectable />)}</tbody>
          </table>
          {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">Nobody matches.</p>}
          {rows.length > 100 && <p className="border-t border-default px-4 py-2.5 text-xs text-muted">Showing the first 100 of {rows.length}. Narrow it with the filters.</p>}
        </div>
      )}

      {view === "supplier" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            {thead("Supplier")}
            <tbody>
              {shownGroups.map((g) => {
                const isOpen = open.has(g.id) || focus?.supplierId === g.id;
                const focusType = focus?.supplierId === g.id ? focus.type : null;
                const workers = [...(focusType ? g.workers.filter((w) => { const s = cells.get(w.id)![focusType].state; return s !== "valid" && s !== "expiring"; }) : g.workers)].sort((a, b) => badness(cells.get(b.id)!) - badness(cells.get(a.id)!));
                const limit = showAll.has(g.id) || focusType ? workers.length : 5;
                const covered = g.workers.filter((w) => w.wcCovered).length;
                return (
                  <FragmentRows key={g.id}>
                    <tr className="cursor-pointer bg-surface-subtle/70 hover:bg-surface-hover" onClick={() => setOpen((p) => { const n = new Set(p); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-subtle" aria-hidden /> : <ChevronRight className="h-4 w-4 text-subtle" aria-hidden />}
                          <span><b className="text-primary">{g.name}</b><span className="block text-xs text-muted">{g.workers.length} workers</span></span>
                        </span>
                      </td>
                      {MATRIX_TYPES.map((t) => (
                        <td key={t} className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <CoverageBar counts={g.counts[t]} n={g.workers.length} label={`${g.name} ${MATRIX_LABEL[t]}`} onClick={() => setFocus({ supplierId: g.id, type: t })} />
                        </td>
                      ))}
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        {g.id === "none" ? <span className="text-xs text-subtle">—</span> : (() => {
                          const cell = g.wc.cell;
                          return <Link href={`/suppliers/${g.id}`} className="inline-block"><CellBox cell={cell} label={`${g.name} workmen compensation`} /><span className="mt-1 block text-[10px] text-muted">{coverageKnown.has(g.id) ? `${covered} of ${g.workers.length} named` : g.wc.policies > 0 ? "list not read" : ""}</span></Link>;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right"><b className="text-primary">{Math.round(pct(g) * 100)}%</b><span className="block text-[10px] text-muted">complete</span></td>
                    </tr>
                    {isOpen && focusType && (
                      <tr><td colSpan={8} className="px-4 py-2 text-xs text-muted">Showing {workers.length} {workers.length === 1 ? "worker" : "workers"} to fix for {MATRIX_LABEL[focusType]}. <button type="button" className="font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setFocus(null)}>Show everyone</button></td></tr>
                    )}
                    {isOpen && workers.slice(0, limit).map((w) => <Worker key={w.id} e={w} indent />)}
                    {isOpen && workers.length > limit && (
                      <tr className="border-t border-default"><td colSpan={8} className="px-4 py-2.5 pl-11"><button type="button" className="text-sm font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setShowAll((p) => new Set(p).add(g.id))}>Show all {workers.length} workers</button></td></tr>
                    )}
                  </FragmentRows>
                );
              })}
            </tbody>
          </table>
          {shownGroups.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No suppliers match.</p>}
        </div>
      )}

      <p className="text-xs text-muted">
        {view === "employee" ? "Click a coloured box to open that document. Click a dashed box to upload the missing one. Workmen comp opens the supplier's policy." : "Each bar shows a supplier's workers for one document: valid, expiring, expired, missing. Click a supplier to open its workers; click a bar to list only the ones to fix."}
      </p>

      {view === "employee" && chosen.length > 0 && (
        <div className="sticky bottom-4 z-20 flex justify-center">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#1e1b3a] py-2.5 pr-2.5 pl-4 text-sm text-white shadow-modal">
            <b className="mr-1">{chosen.length} selected</b>
            <button type="button" onClick={() => setPrinting(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10"><Printer className="h-3.5 w-3.5" aria-hidden />Print…</button>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white">Clear</button>
          </div>
        </div>
      )}
      <PrintDialog
        open={printing && view === "employee"}
        onOpenChange={setPrinting}
        title="Print documents"
        subject={`${chosen.length} ${chosen.length === 1 ? "employee" : "employees"}`}
        options={printOptions}
        count={printCount}
        onPrint={(kinds) => printDocuments(employeePrintIds(chosen.map((e) => e.id), kinds as PrintKind[], cells).ids)}
      />

      <Dialog.Root open={!!current} onOpenChange={(o) => !o && setOpenDoc(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="rx-overlay fixed inset-0 z-40 bg-[#101828]/30" />
          <Dialog.Content aria-describedby={undefined} className="fixed top-3 right-3 bottom-3 z-50 flex w-[min(34rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[20px] border border-default bg-surface shadow-modal outline-none">
            {current && (
              <Preview
                now={now}
                doc={current}
                index={idx}
                total={orderForPreview.length}
                onPrev={idx > 0 ? () => setOpenDoc(orderForPreview[idx - 1]) : undefined}
                onNext={idx >= 0 && idx < orderForPreview.length - 1 ? () => setOpenDoc(orderForPreview[idx + 1]) : undefined}
                onPrint={() => window.open(`/api/documents/print?ids=${current.id}`, "_blank")}
                onDelete={async () => { await deleteDocumentsAction([current.id]); setOpenDoc(null); router.refresh(); }}
                onRenewed={() => router.refresh()}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!uploadFor} onOpenChange={(o) => !o && setUploadFor(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="rx-overlay fixed inset-0 z-40 bg-[#101828]/40 backdrop-blur-[2px]" />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-default bg-surface p-5 shadow-modal outline-none">
            {uploadFor && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div><Dialog.Title className="text-base font-semibold text-primary">Upload {typeLabel(uploadFor.type)}</Dialog.Title><p className="text-sm text-muted">{uploadFor.employee.name} · {uploadFor.employee.employeeIdNo}</p></div>
                  <Dialog.Close aria-label="Close" className="rounded p-1 text-subtle hover:bg-surface-hover"><X className="h-4 w-4" aria-hidden /></Dialog.Close>
                </div>
                <div className="mt-4">
                  <ScanUpload employeeId={uploadFor.employee.id} docType={uploadFor.type} hasPhoto={uploadFor.employee.hasPhoto} title={`Drop the ${typeLabel(uploadFor.type).toLowerCase()} here`} hint="Click or drop a file. The expiry date is read for you." onDone={() => { setUploadFor(null); router.refresh(); }} />
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

/** Table body rows grouped without adding a wrapper element. */
function FragmentRows({ children }: { children: React.ReactNode }) { return <>{children}</>; }

/** One bar for a supplier's workers: valid, expiring, expired, missing. */
function CoverageBar({ counts, n, label, onClick }: { counts: Record<CellState, number>; n: number; label: string; onClick: () => void }) {
  const seg = (k: CellState, color: string) => <span style={{ width: `${n ? (counts[k] / n) * 100 : 0}%`, background: color }} />;
  const ok = counts.valid + counts.expiring;
  return (
    <button type="button" onClick={onClick} aria-label={`${label}: ${ok} of ${n} ok`} className="block w-full min-w-[5.5rem] text-left">
      <span className="flex h-2 overflow-hidden rounded-full bg-surface-sunken">{seg("valid", "var(--success)")}{seg("expiring", "var(--warning)")}{seg("expired", "var(--error)")}</span>
      <span className="mt-1 block text-[10.5px] text-muted">{ok} of {n} ok{counts.expired > 0 && <b className="text-[var(--error)]"> · {counts.expired} expired</b>}{counts.missing > 0 && ` · ${counts.missing} missing`}</span>
    </button>
  );
}

function ViewsMenu({ saved, applied, onApply, onSave, onDelete }: { saved: SavedView[]; applied: SavedView | null; onApply: (v: SavedView) => void; onSave: (name: string) => void; onDelete: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const item = "flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm text-secondary hover:bg-surface-hover hover:text-primary";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="btn btn-secondary w-44 justify-between gap-1.5"><span className="flex items-center gap-1.5 truncate"><Star className="h-4 w-4 shrink-0" aria-hidden />{applied ? applied.name : "Views"}</span><ChevronDown className="h-4 w-4 shrink-0 text-subtle" aria-hidden /></button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} className="rx-popover z-50 w-72 rounded-control border border-default bg-surface p-1.5 shadow-popover">
          <p className="px-2.5 py-1 text-[11px] font-medium tracking-wide text-muted uppercase">Views</p>
          {[...BUILT_IN, ...saved].map((v, i) => (
            <div key={`${v.name}-${i}`} className="flex items-center">
              <button type="button" className={item} onClick={() => { onApply(v); setOpen(false); }}>{v.name}<span className="text-[10px] text-subtle">{v.view === "supplier" ? "suppliers" : "workers"}</span></button>
              {i >= BUILT_IN.length && <button type="button" aria-label={`Delete view ${v.name}`} onClick={() => onDelete(v.name)} className="p-1.5 text-subtle hover:text-[var(--error)]"><X className="h-3.5 w-3.5" aria-hidden /></button>}
            </div>
          ))}
          <form className="mt-1 flex gap-1.5 border-t border-default p-1.5 pt-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onSave(name.trim()); setName(""); setOpen(false); } }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Save these filters as…" aria-label="View name" className="input h-8 min-w-0 flex-1 px-2 text-sm" />
            <button type="submit" disabled={!name.trim()} className="btn btn-primary btn-sm">Save</button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
