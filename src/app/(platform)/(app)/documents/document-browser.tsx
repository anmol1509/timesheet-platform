"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { ChevronLeft, ChevronRight, Download, FileText, MoreHorizontal, Printer, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/Badge";
import { EmployeeAvatar } from "@/components/Avatar";
import { Pagination } from "@/components/Pagination";
import { uploadDocumentAction } from "@/app/(platform)/(app)/employees/[id]/actions";
import { ScanUpload } from "@/app/(platform)/(app)/employees/scan-upload";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { cn } from "@/lib/cn";
import { deleteDocumentsAction } from "./actions";

export type DocRow = {
  id: string;
  filename: string;
  type: string;
  employeeId: string;
  employeeName: string;
  employeeIdNo: string;
  employeeHasPhoto: boolean;
  mimeType: string;
  supplierId: string | null;
  supplierName: string | null;
  projectId: string | null;
  projectName: string | null;
  uploadedByName: string;
  uploadedAt: string;
  expiryDate: string | null;
  status: "valid" | "expiring" | "expired" | "not_set";
};

type EmployeeOption = { id: string; name: string; employeeIdNo: string };
type Tab = "all" | "expired" | "expiring" | "valid" | "no_expiry";
type Sort = "expiry" | "uploaded" | "employee";

const PAGE_SIZE = 25;
const DAY = 86_400_000;

const STATUS_BADGE = {
  valid: { label: "Valid", color: "green" as const },
  expiring: { label: "Expiring soon", color: "amber" as const },
  expired: { label: "Expired", color: "red" as const },
  not_set: { label: "No expiry", color: "slate" as const },
};

const DOC_TYPES = ["PASSPORT", "VISA", "LABOR_CARD", "MEDICAL", "EMIRATES_ID", "OTHER"];
export const typeLabel = (t: string) => t.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bId\b/, "ID");

export const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** "Expired 25 days ago", "In 5 days", "In 14 months". */
export function relative(iso: string | null, now: number) {
  if (!iso) return "";
  const days = Math.round((new Date(iso).getTime() - now) / DAY);
  const n = Math.abs(days);
  const span = n < 60 ? `${n} day${n === 1 ? "" : "s"}` : n < 730 ? `${Math.round(n / 30)} months` : `${Math.round(n / 365)} years`;
  return days < 0 ? `Expired ${span} ago` : days === 0 ? "Expires today" : `In ${span}`;
}

const expiryKey = (d: DocRow) => (d.expiryDate ? new Date(d.expiryDate).getTime() : Number.POSITIVE_INFINITY);

export function DocumentBrowser({ documents, employees, suppliers, projects, canBulkImport }: {
  documents: DocRow[];
  employees: EmployeeOption[];
  suppliers: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  canBulkImport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Fixed when the page opens, so "in 5 days" and the expiry-window filter agree with each other.
  const [now] = useState(() => Date.now());
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    initialTab === "valid" || initialTab === "expiring" || initialTab === "expired" || initialTab === "no_expiry" ? initialTab : "all"
  );
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [project, setProject] = useState("");
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [within, setWithin] = useState("");
  const [sort, setSort] = useState<Sort>("expiry");
  const [showUpload, setShowUpload] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(searchParams.get("employee"));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredEmployee = employees.find((e) => e.id === employeeFilter) || null;
  const reset = () => setPage(1);

  const matchesTab = (d: DocRow, t: Tab) =>
    t === "all" || (t === "valid" && d.status === "valid") || (t === "expiring" && d.status === "expiring") || (t === "expired" && d.status === "expired") || (t === "no_expiry" && d.status === "not_set");
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    const horizon = within ? now + Number(within) * DAY : null;
    return documents.filter(
      (d) =>
        (!employeeFilter || d.employeeId === employeeFilter) &&
        (!type || d.type === type) &&
        (!project || d.projectId === project) &&
        (supplierIds.length === 0 || (d.supplierId && supplierIds.includes(d.supplierId))) &&
        (horizon === null || (d.expiryDate && new Date(d.expiryDate).getTime() <= horizon)) &&
        (!q || `${d.filename} ${typeLabel(d.type)} ${d.employeeName} ${d.employeeIdNo}`.toLowerCase().includes(q))
    );
  }, [documents, query, type, project, supplierIds, within, employeeFilter, now]);

  const filtered = useMemo(() => {
    const rows = base.filter((d) => matchesTab(d, tab));
    return [...rows].sort((a, b) =>
      sort === "expiry" ? expiryKey(a) - expiryKey(b) : sort === "uploaded" ? b.uploadedAt.localeCompare(a.uploadedAt) : a.employeeName.localeCompare(b.employeeName)
    );
  }, [base, tab, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const count = (t: Tab) => base.filter((d) => matchesTab(d, t)).length;
  const typesPresent = [...new Set(documents.map((d) => d.type))].sort();

  const allShownSelected = visible.length > 0 && visible.every((d) => selected.has(d.id));
  const someShownSelected = visible.some((d) => selected.has(d.id));
  const chosenIds = filtered.filter((d) => selected.has(d.id)).map((d) => d.id);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleShown() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) for (const d of visible) next.delete(d.id);
      else for (const d of visible) next.add(d.id);
      return next;
    });
  }

  const printIds = (ids: string[]) => window.open(`/api/documents/print?ids=${ids.join(",")}`, "_blank");
  const zipIds = (ids: string[]) => { window.location.href = `/api/documents/zip?ids=${ids.join(",")}`; };
  function removeIds(ids: string[]) {
    startTransition(async () => {
      const res = await deleteDocumentsAction(ids);
      setNotice(res.error ?? `Deleted ${res.deleted} ${res.deleted === 1 ? "document" : "documents"}.`);
      setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
      setOpenId(null);
      router.refresh();
    });
  }

  /** The filtered list as a clean page to print: the browser's own print dialog does the rest. */
  function printList() {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const rowsHtml = filtered
      .map((d) => `<tr><td>${esc(d.employeeName)}<br><small>${esc(d.employeeIdNo)}</small></td><td>${esc(typeLabel(d.type))}</td><td>${esc(d.supplierName ?? "")}</td><td>${d.expiryDate ? esc(fmt(d.expiryDate)) : "—"}</td><td>${esc(STATUS_BADGE[d.status].label)}</td></tr>`)
      .join("");
    w.document.write(`<!doctype html><title>Documents</title><style>body{font:13px system-ui,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 14px;color:#555}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#666}small{color:#777}</style><h1>Documents</h1><p>${filtered.length} document${filtered.length === 1 ? "" : "s"} · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p><table><thead><tr><th>Employee</th><th>Document</th><th>Supplier</th><th>Expires</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table>`);
    w.document.close();
    w.focus();
    w.print();
  }

  const openDoc = openId ? filtered.find((d) => d.id === openId) ?? documents.find((d) => d.id === openId) ?? null : null;
  const openIndex = openDoc ? filtered.findIndex((d) => d.id === openDoc.id) : -1;
  const hasFilters = !!(type || project || supplierIds.length || within || query || employeeFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => { setQuery(e.target.value); reset(); }} placeholder="Search employee, ID, file…" aria-label="Search documents" className="input min-w-[14rem] flex-1" />
        <div className="w-40"><Select value={type} onChange={(v) => { setType(v); reset(); }} searchable={false} placeholder="All types" options={[{ value: "", label: "All types" }, ...typesPresent.map((t) => ({ value: t, label: typeLabel(t) }))]} /></div>
        <div className="w-52"><MultiSelect values={supplierIds} onChange={(v) => { setSupplierIds(v); reset(); }} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} noun="suppliers" placeholder="All suppliers" /></div>
        <div className="w-52"><Select value={project} onChange={(v) => { setProject(v); reset(); }} placeholder="All projects" options={[{ value: "", label: "All projects" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} /></div>
        <div className="w-44"><Select value={within} onChange={(v) => { setWithin(v); reset(); }} searchable={false} placeholder="Expiry: any time" options={[{ value: "", label: "Expiry: any time" }, { value: "30", label: "Expires within 30 days" }, { value: "60", label: "Within 60 days" }, { value: "90", label: "Within 90 days" }]} /></div>
        {hasFilters && (
          <button type="button" onClick={() => { setQuery(""); setType(""); setProject(""); setSupplierIds([]); setWithin(""); setEmployeeFilter(null); reset(); }} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Clear filters</button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filteredEmployee && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-medium text-secondary">
            {filteredEmployee.name}
            <button type="button" onClick={() => setEmployeeFilter(null)} aria-label="Remove employee filter" className="text-subtle hover:text-secondary"><X className="h-3 w-3" /></button>
          </span>
        )}
        {([["all", "All"], ["expired", "Expired"], ["expiring", "Expiring soon"], ["valid", "Valid"], ["no_expiry", "No expiry"]] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => { setTab(key); reset(); }} className={cn("rounded-control border px-3 py-1.5 text-xs font-medium transition", tab === key ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default bg-surface text-secondary hover:bg-surface-hover")}>
            {label} ({count(key)})
          </button>
        ))}
        <span className="flex-1" />
        <div className="w-44"><Select value={sort} onChange={(v) => setSort(v as Sort)} searchable={false} options={[{ value: "expiry", label: "Soonest expiry first" }, { value: "uploaded", label: "Newest upload" }, { value: "employee", label: "Employee A–Z" }]} /></div>
        <button type="button" onClick={printList} disabled={filtered.length === 0} className="btn btn-secondary gap-1.5"><Printer className="h-4 w-4" aria-hidden />Print list</button>
        {canBulkImport && <Link href="/import/new/documents" className="btn btn-secondary">Bulk upload</Link>}
        <button type="button" onClick={() => setShowUpload((v) => !v)} className="btn btn-primary gap-1.5"><Upload className="h-4 w-4" aria-hidden />{showUpload ? "Cancel" : "Upload"}</button>
      </div>

      {showUpload && <UploadForm employees={employees} onDone={() => setShowUpload(false)} />}
      {notice && <p role="status" className="text-sm text-secondary">{notice}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allShownSelected} indeterminate={!allShownSelected && someShownSelected} onCheckedChange={toggleShown} ariaLabel="Select all documents shown" />
                </th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visible.map((d) => {
                const badge = STATUS_BADGE[d.status];
                return (
                  <tr key={d.id} onClick={() => setOpenId(d.id)} className={cn("cursor-pointer hover:bg-surface-hover", selected.has(d.id) && "bg-brand-soft")}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggle(d.id)} ariaLabel={`Select ${typeLabel(d.type)} for ${d.employeeName}`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar employeeId={d.employeeId} name={d.employeeName} hasPhoto={d.employeeHasPhoto} size="sm" />
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-primary">{d.employeeName}</span>
                          <span className="tabular text-xs text-subtle">{d.employeeIdNo}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-secondary">{typeLabel(d.type)}</td>
                    <td className="px-4 py-3 text-muted"><span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" aria-hidden />{d.filename}</span></td>
                    <td className="px-4 py-3">
                      {d.expiryDate ? (<><span className="text-primary">{fmt(d.expiryDate)}</span><span className="block text-xs text-subtle">{relative(d.expiryDate, now)}</span></>) : <span className="text-subtle">—</span>}
                    </td>
                    <td className="px-4 py-3"><Badge color={badge.color}>{badge.label}</Badge></td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        label={`${typeLabel(d.type)} for ${d.employeeName}`}
                        onPreview={() => setOpenId(d.id)}
                        href={`/api/documents/${d.id}`}
                        onPrint={() => printIds([d.id])}
                        onDelete={() => removeIds([d.id])}
                        confirm={`Delete "${d.filename}" from ${d.employeeName}'s file? The file itself is removed and can't be recovered.`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No documents match.</p>}
        {filtered.length > 0 && <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />}
      </div>

      {chosenIds.length > 0 && (
        <div className="sticky bottom-4 z-20 flex justify-center">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#1e1b3a] py-2.5 pr-2.5 pl-4 text-sm text-white shadow-modal">
            <b className="mr-1">{chosenIds.length} selected</b>
            <button type="button" onClick={() => zipIds(chosenIds)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10"><Download className="h-3.5 w-3.5" aria-hidden />Download (ZIP)</button>
            <button type="button" onClick={() => printIds(chosenIds)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10"><Printer className="h-3.5 w-3.5" aria-hidden />Print</button>
            <ConfirmDialog
              title={`Delete ${chosenIds.length} ${chosenIds.length === 1 ? "document" : "documents"}?`}
              description="The files are removed and can't be recovered."
              confirmLabel="Delete"
              onConfirm={() => removeIds(chosenIds)}
              trigger={(open) => (
                <button type="button" onClick={open} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300/50 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-white/10 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" aria-hidden />Delete</button>
              )}
            />
            <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear selection" className="rounded-lg px-2 py-1.5 text-white/70 hover:text-white"><X className="h-4 w-4" aria-hidden /></button>
          </div>
        </div>
      )}

      <Dialog.Root open={!!openDoc} onOpenChange={(o) => !o && setOpenId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="rx-overlay fixed inset-0 z-40 bg-[#101828]/30" />
          <Dialog.Content aria-describedby={undefined} className="fixed top-3 right-3 bottom-3 z-50 flex w-[min(34rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[20px] border border-default bg-surface shadow-modal outline-none">
            {openDoc && (
              <Preview
                now={now}
                doc={openDoc}
                index={openIndex}
                total={filtered.length}
                onPrev={openIndex > 0 ? () => setOpenId(filtered[openIndex - 1].id) : undefined}
                onNext={openIndex >= 0 && openIndex < filtered.length - 1 ? () => setOpenId(filtered[openIndex + 1].id) : undefined}
                onPrint={() => printIds([openDoc.id])}
                onDelete={() => removeIds([openDoc.id])}
                onRenewed={() => router.refresh()}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

/** One "⋯" per row instead of a link per action. */
function RowMenu({ label, onPreview, href, onPrint, onDelete, confirm }: { label: string; onPreview: () => void; href: string; onPrint: () => void; onDelete: () => void; confirm: string }) {
  const [open, setOpen] = useState(false);
  const item = "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm text-secondary hover:bg-surface-hover hover:text-primary";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`Actions for ${label}`} className="rounded-md p-1.5 text-subtle hover:bg-surface-sunken hover:text-primary"><MoreHorizontal className="h-4 w-4" aria-hidden /></button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} className="rx-popover z-50 w-44 rounded-control border border-default bg-surface p-1 shadow-popover">
          <button type="button" className={item} onClick={() => { setOpen(false); onPreview(); }}><FileText className="h-4 w-4" aria-hidden />Preview</button>
          <a className={item} href={href} download onClick={() => setOpen(false)}><Download className="h-4 w-4" aria-hidden />Download</a>
          <button type="button" className={item} onClick={() => { setOpen(false); onPrint(); }}><Printer className="h-4 w-4" aria-hidden />Print</button>
          <ConfirmDialog
            title="Delete this document?"
            description={confirm}
            confirmLabel="Delete"
            onConfirm={() => { setOpen(false); onDelete(); }}
            trigger={(openConfirm) => <button type="button" className={cn(item, "text-[var(--error)] hover:text-[var(--error)]")} onClick={openConfirm}><Trash2 className="h-4 w-4" aria-hidden />Delete</button>}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function Preview({ now, doc, index, total, onPrev, onNext, onPrint, onDelete, onRenewed }: { now: number; doc: DocRow; index: number; total: number; onPrev?: () => void; onNext?: () => void; onPrint: () => void; onDelete: () => void; onRenewed: () => void }) {
  const badge = STATUS_BADGE[doc.status];
  const [renew, setRenew] = useState(false);
  const isPdf = doc.mimeType === "application/pdf";
  const isImage = doc.mimeType.startsWith("image/");
  const row = "flex items-center justify-between gap-4 border-b border-default py-2.5 text-sm last:border-b-0";
  return (
    <>
      <div className="bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] px-5 py-4 text-white">
        <div className="flex items-center justify-between text-xs text-white/80">
          <span className="flex items-center gap-1">
            <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Previous document" className="rounded p-0.5 hover:bg-white/15 disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
            <button type="button" onClick={onNext} disabled={!onNext} aria-label="Next document" className="rounded p-0.5 hover:bg-white/15 disabled:opacity-40"><ChevronRight className="h-4 w-4" aria-hidden /></button>
            {index >= 0 ? `${index + 1} of ${total}` : ""}
          </span>
          <span className="flex items-center gap-3">
            <Link href={`/employees/${doc.employeeId}`} className="hover:underline">Open employee ↗</Link>
            <Dialog.Close aria-label="Close" className="rounded p-0.5 hover:bg-white/15"><X className="h-4 w-4" aria-hidden /></Dialog.Close>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <EmployeeAvatar employeeId={doc.employeeId} name={doc.employeeName} hasPhoto={doc.employeeHasPhoto} size="lg" />
          <div className="min-w-0 flex-1">
            <Dialog.Title className="truncate text-lg font-semibold">{typeLabel(doc.type)}</Dialog.Title>
            <p className="truncate text-sm text-white/80">{doc.employeeName} · {doc.employeeIdNo}</p>
          </div>
          <Badge color={badge.color}>{badge.label}</Badge>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex h-72 items-center justify-center overflow-hidden rounded-xl border border-default bg-surface-sunken">
          {isPdf ? (
            <iframe src={`/api/documents/${doc.id}#toolbar=0`} title={doc.filename} className="h-full w-full" />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/documents/${doc.id}`} alt={doc.filename} className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="text-center text-sm text-muted"><FileText className="mx-auto mb-2 h-10 w-10" aria-hidden />No preview for this file type.<br />Use Download.</div>
          )}
        </div>
        <div className="card px-4 py-1">
          <div className={row}><span className="text-muted">Expires</span><b className={cn(doc.status === "expired" && "text-[var(--error)]", doc.status === "expiring" && "text-[var(--warning)]")}>{doc.expiryDate ? `${fmt(doc.expiryDate)} · ${relative(doc.expiryDate, now)}` : "No expiry"}</b></div>
          <div className={row}><span className="text-muted">File</span><span className="truncate">{doc.filename}</span></div>
          <div className={row}><span className="text-muted">Uploaded</span><span>{fmt(doc.uploadedAt)} · by {doc.uploadedByName}</span></div>
          <div className={row}><span className="text-muted">Supplier</span><span className="truncate">{doc.supplierName ?? "—"}</span></div>
          <div className={row}><span className="text-muted">Project</span><span className="truncate">{doc.projectName ?? "—"}</span></div>
        </div>
        {(doc.status === "expired" || doc.status === "expiring") && !renew && (
          <p className="rounded-xl border border-[var(--warning-border,var(--border))] bg-[var(--warning-soft)] px-4 py-3 text-sm text-primary">
            <b>{doc.status === "expired" ? relative(doc.expiryDate, now) : `Expires ${relative(doc.expiryDate, now).toLowerCase()}`}.</b> Upload the renewed {typeLabel(doc.type).toLowerCase()} to replace it. The new expiry is read from the scan.
          </p>
        )}
        {renew && (
          <ScanUpload
            employeeId={doc.employeeId}
            docType={doc.type}
            hasPhoto={doc.employeeHasPhoto}
            title={`Upload the new ${typeLabel(doc.type).toLowerCase()}`}
            hint="Drop a file or click. The expiry is read for you."
            onDone={() => { setRenew(false); onRenewed(); }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-default px-5 py-3.5">
        <button type="button" onClick={onPrint} className="btn btn-secondary gap-1.5"><Printer className="h-4 w-4" aria-hidden />Print</button>
        <a href={`/api/documents/${doc.id}`} download className="btn btn-secondary gap-1.5"><Download className="h-4 w-4" aria-hidden />Download</a>
        <ConfirmDialog
          title="Delete this document?"
          description={`Delete "${doc.filename}" from ${doc.employeeName}'s file? The file itself is removed and can't be recovered.`}
          confirmLabel="Delete"
          onConfirm={onDelete}
          trigger={(open) => <button type="button" onClick={open} className="btn btn-secondary text-[var(--error)]">Delete</button>}
        />
        <span className="flex-1" />
        <button type="button" onClick={() => setRenew((v) => !v)} className="btn btn-primary">{renew ? "Cancel renewal" : "Renew (upload new)"}</button>
      </div>
    </>
  );
}

function UploadForm({ employees, onDone }: { employees: EmployeeOption[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState("PASSPORT");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !employeeId) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`"${file.name}" is too large — max ${MAX_UPLOAD_LABEL}.`);
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("type", type);
    formData.append("expiryDate", expiryDate);
    formData.append("file", file);
    startTransition(async () => {
      await uploadDocumentAction(formData);
      router.refresh();
      onDone();
    });
  }

  if (employees.length === 0) {
    return (
      <p className="rounded-lg bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">
        No employees on record yet — <Link href="/employees/new" className="underline">add one</Link> before uploading documents.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-wrap items-end gap-3 p-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Employee</span>
        <Select value={employeeId} onChange={setEmployeeId} placeholder="Type a name or ID…" triggerClassName="w-64" options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employeeIdNo})` }))} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Type</span>
        <Select value={type} onChange={setType} searchable={false} options={DOC_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Expiry date (optional)</span>
        <DatePicker value={expiryDate} onChange={(v) => setExpiryDate(v)} />
      </label>
      <input ref={fileRef} type="file" required className="file-input" />
      <button type="submit" disabled={pending || !employeeId} className="btn btn-primary">{pending ? "Uploading…" : "Upload"}</button>
      {error && <p className="w-full text-xs text-[var(--error)]">{error}</p>}
    </form>
  );
}
