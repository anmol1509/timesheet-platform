"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Loader2, Upload, X } from "lucide-react";
import { Badge, type BadgeColor } from "@/components/Badge";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { DeleteButton } from "@/components/DeleteButton";
import { OtherDocFields } from "@/components/OtherDocFields";
import { readOtherDoc } from "@/components/otherDocRead";
import { readCompanyDoc } from "@/components/companyDocRead";
import { nameFromFile, otherDocProblem, trackedExpiry } from "@/lib/otherDoc";
import { deleteAttachmentAction } from "@/lib/attachments";
import { uploadAttachment } from "@/lib/uploadAttachment";
import { MAX_UPLOAD_LABEL } from "@/lib/constants";
import { cn } from "@/lib/cn";

import { Button } from "@/components/ui/Button";
export type DocFile = { id: string; docType: string; filename: string; expiryDate: string | null; uploadedAt: string; docNumber?: string | null; issueDate?: string | null };
export type DocRow = {
  key: string;
  label: string;
  required: boolean;
  hasExpiry: boolean;
  state: "valid" | "expiring" | "expired" | "missing" | "uploaded";
  daysLeft: number | null;
  /** The number printed on the current file (licence, permit, certificate number); the company's own record fills in when the file has none. */
  detail: string;
  /** Issue date of the current file. */
  currentIssue: string | null;
  /** How many files this type holds, counting ones a restricted person may not open. */
  count: number;
  /** The files this person may open, newest expiry first. */
  files: DocFile[];
  /** The file that stands for the type, for the status and expiry columns. */
  currentExpiry: string | null;
};

const STATE: Record<DocRow["state"], { label: string; color: BadgeColor }> = {
  valid: { label: "Valid", color: "green" },
  uploaded: { label: "On file", color: "blue" },
  expiring: { label: "Expiring", color: "amber" },
  expired: { label: "Expired", color: "red" },
  missing: { label: "Missing", color: "slate" },
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

type Queued = { id: number; file: File; type: string; name: string; expiry: string; number: string; issue: string; state: "reading" | "ready" | "saving" | "failed"; note?: string };

/**
 * A company's documents as one table: a row per document type with its status, expiry and file. Uploading a file reads it
 * for the expiry date (and, for the catch-all "Other", its name), which the person checks before saving. Several files can
 * be dropped at once; each is sorted into its type by what it is.
 */
export function CompanyDocsTable({ rows, legacy, supplierId, revalidate, canEdit, restricted, canOpen }: {
  rows: DocRow[]; legacy: DocFile[]; supplierId: string; revalidate: string; canEdit: boolean; restricted: boolean; canOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [filesOpen, setFilesOpen] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<Queued[]>([]);
  const [over, setOver] = useState(false);
  const bulkInput = useRef<HTMLInputElement>(null);
  const uploadable = (key: string) => canEdit && (!restricted || key === "LETTERHEAD");
  const typeOptions = rows.filter((r) => uploadable(r.key)).map((r) => ({ value: r.key, label: r.label }));
  const toggleFiles = (key: string) => setFilesOpen((cur) => { const n = new Set(cur); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  async function addBulk(files: File[]) {
    if (!canEdit || files.length === 0) return;
    const base = Date.now();
    const items: Queued[] = files.map((file, i) => ({ id: base + i, file, type: "OTHER", name: nameFromFile(file.name), expiry: "", number: "", issue: "", state: "reading" }));
    setQueue((cur) => [...cur, ...items]);
    const patch = (id: number, p: Partial<Queued>) => setQueue((cur) => cur.map((q) => (q.id === id ? { ...q, ...p } : q)));
    // Three at a time, so a big drop does not wait on one slow file.
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const item = items[next++];
        const read = await readCompanyDoc(item.file);
        if (!read) { patch(item.id, { state: "ready", note: "Couldn't read this file. Choose what it is and type the expiry." }); continue; }
        const known = typeOptions.some((o) => o.value === read.docType);
        patch(item.id, { state: "ready", type: known ? read.docType : "OTHER", expiry: read.expiry, number: read.number, issue: read.issue, note: known ? (read.expiry ? "Read from the file. Check it before filing." : "Read from the file. No expiry date found.") : "Not one of the listed documents, so it goes under Other." });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  async function fileAll() {
    for (const q of queue.filter((x) => x.state === "ready")) {
      const isOther = q.type === "OTHER";
      const why = isOther ? otherDocProblem(q.name, !!q.expiry, q.expiry) : null;
      if (why) { setQueue((cur) => cur.map((x) => (x.id === q.id ? { ...x, state: "failed", note: why } : x))); continue; }
      setQueue((cur) => cur.map((x) => (x.id === q.id ? { ...x, state: "saving" } : x)));
      const fd = new FormData();
      fd.set("entityType", "SUPPLIER"); fd.set("entityId", supplierId); fd.set("revalidate", revalidate);
      fd.set("docType", q.type); fd.set("file", q.file);
      fd.set("expiryDate", q.expiry);
      fd.set("docNumber", q.number); fd.set("issueDate", q.issue);
      if (isOther) fd.set("name", q.name.trim());
      const res = await uploadAttachment(fd);
      if (res?.error) setQueue((cur) => cur.map((x) => (x.id === q.id ? { ...x, state: "failed", note: res.error } : x)));
      else setQueue((cur) => cur.filter((x) => x.id !== q.id));
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void addBulk([...e.dataTransfer.files]); }}
          className={cn("flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed px-4 py-3 text-sm transition", over ? "border-[var(--brand-primary)] bg-brand-soft" : "border-strong")}
        >
          <span className="text-muted">Drop several files here and the AI sorts them into trade licence, MOHRE permit and the rest, and reads each expiry date.</span>
          <button type="button" className="btn btn-primary btn-sm inline-flex items-center gap-1.5" onClick={() => bulkInput.current?.click()}><Upload className="h-3.5 w-3.5" aria-hidden />Upload files</button>
          <input ref={bulkInput} type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" onChange={(e) => { void addBulk([...(e.target.files ?? [])]); e.target.value = ""; }} />
        </div>
      )}

      {queue.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-default bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-primary">Ready to file ({queue.length})</h3>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQueue([])}>Clear</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={queue.some((q) => q.state === "reading" || q.state === "saving") || !queue.some((q) => q.state === "ready")} onClick={() => void fileAll()}>File all</button>
            </div>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {queue.map((q) => (
              <li key={q.id} className="grid items-start gap-3 py-3 lg:grid-cols-[minmax(0,1.2fr)_14rem_13rem_auto]">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-primary"><FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />{q.file.name}</p>
                  <p className={cn("mt-0.5 text-xs", q.state === "failed" ? "text-[var(--error)]" : "text-muted")}>{q.state === "reading" ? "Reading the file…" : q.state === "saving" ? "Filing…" : q.note}</p>
                </div>
                <Select value={q.type} onChange={(v) => setQueue((cur) => cur.map((x) => (x.id === q.id ? { ...x, type: v } : x)))} options={typeOptions} disabled={q.state === "reading" || q.state === "saving"} />
                <DatePicker value={q.expiry} onChange={(v) => setQueue((cur) => cur.map((x) => (x.id === q.id ? { ...x, expiry: v } : x)))} ariaLabel="Expiry date" placeholder="Expiry (optional)" disabled={q.state === "reading" || q.state === "saving"} className="w-full" />
                <button type="button" aria-label={`Remove ${q.file.name}`} className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-primary" onClick={() => setQueue((cur) => cur.filter((x) => x.id !== q.id))}><X className="h-4 w-4" /></button>
                {q.type !== "OTHER" && (
                  <label className="block lg:col-span-4">
                    <span className="mb-1 block text-xs font-medium text-muted">Number on the document (optional)</span>
                    <input value={q.number} onChange={(e) => setQueue((cur) => cur.map((x) => (x.id === q.id ? { ...x, number: e.target.value } : x)))} className="input w-full max-w-xs" placeholder="e.g. licence or permit number" />
                  </label>
                )}
                {q.type === "OTHER" && (
                  <label className="block lg:col-span-4">
                    <span className="mb-1 block text-xs font-medium text-muted">Name of this document</span>
                    <input value={q.name} onChange={(e) => setQueue((cur) => cur.map((x) => (x.id === q.id ? { ...x, name: e.target.value } : x)))} className="input w-full" placeholder="e.g. Fire safety certificate" />
                    <span className="mt-1 block text-xs text-muted">{q.expiry ? "Its expiry is tracked, so a reminder is sent before it runs out." : "No expiry date, so no reminder is sent."}</span>
                  </label>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-default bg-surface">
        <table className="w-full min-w-[62rem] text-sm">
          <thead className="bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr><th className="px-4 py-2.5">Document</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Number</th><th className="px-3 py-2.5">Issued</th><th className="px-3 py-2.5">Expires</th><th className="px-3 py-2.5">File</th><th className="px-3 py-2.5 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((r) => {
              const missingRequired = r.state === "missing" && r.required;
              const st = STATE[r.state];
              const isOther = r.key === "OTHER";
              const current = r.files[0];
              const expanded = open === r.key;
              return (
                <RowGroup key={r.key}>
                  <tr className={cn(expanded && "bg-brand-soft/30")}>
                    <td className="px-4 py-3 align-top">
                      <span className="font-medium text-primary">{r.label}</span>
                      {r.required && <span className="ml-2 text-xs text-muted">Required</span>}
                    </td>
                    <td className="px-3 py-3 align-top">{isOther && r.count === 0 ? <Badge color="slate">None yet</Badge> : <Badge color={missingRequired ? "red" : st.color}>{missingRequired ? "Missing: required" : st.label}</Badge>}</td>
                    <td className="tabular px-3 py-3 align-top text-secondary">{r.detail || <span className="text-muted">-</span>}</td>
                    <td className="tabular px-3 py-3 align-top text-secondary">{r.currentIssue ? shortDate(r.currentIssue) : <span className="text-muted">-</span>}</td>
                    <td className="tabular px-3 py-3 align-top text-secondary">
                      {r.currentExpiry && r.hasExpiry ? <>{shortDate(r.currentExpiry)}<span className="block text-xs text-muted">{r.daysLeft !== null && r.daysLeft < 0 ? `expired ${-r.daysLeft}d ago` : `${r.daysLeft}d left`}</span></> : <span className="text-muted">{r.hasExpiry ? "-" : "No expiry"}</span>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {!canOpen && r.count > 0 && <span className="text-xs text-muted">On file · restricted</span>}
                      {canOpen && current && !isOther && <a href={`/api/attachments/${current.id}`} target="_blank" rel="noreferrer" className="block max-w-[16rem] truncate text-xs text-[var(--brand-primary)] hover:underline">{current.filename}</a>}
                      {canOpen && !isOther && r.files.length > 1 && (
                        <button type="button" onClick={() => toggleFiles(r.key)} aria-expanded={filesOpen.has(r.key)} className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted hover:text-primary">{r.files.length} files<ChevronDown className={cn("h-3 w-3 transition", filesOpen.has(r.key) && "rotate-180")} aria-hidden /></button>
                      )}
                      {isOther && r.files.length > 0 && <span className="text-xs text-muted">{r.files.length} {r.files.length === 1 ? "document" : "documents"} below</span>}
                    </td>
                    <td className="px-3 py-3 text-right align-top">
                      {uploadable(r.key) && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(expanded ? null : r.key)}>
                          {expanded ? "Cancel" : isOther ? "Add document" : r.count > 0 ? "Renew" : "Upload"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr><td colSpan={7} className="bg-brand-soft/20 px-4 py-4"><RowUploader row={r} supplierId={supplierId} revalidate={revalidate} onDone={() => { setOpen(null); router.refresh(); }} /></td></tr>
                  )}
                  {canOpen && ((!isOther && filesOpen.has(r.key)) || isOther) && r.files.length > 0 && (
                    <tr><td colSpan={7} className="bg-surface-subtle/60 px-4 py-2"><FileList files={r.files} revalidate={revalidate} canEdit={canEdit && uploadable(r.key)} showName={isOther} /></td></tr>
                  )}
                </RowGroup>
              );
            })}
          </tbody>
        </table>
      </div>

      {legacy.length > 0 && canOpen && (
        <div className="rounded-2xl border border-default bg-surface p-4">
          <h3 className="mb-1 text-sm font-semibold text-primary">Older files</h3>
          <p className="mb-2 text-xs text-muted">Filed under a document type this company no longer lists.</p>
          <FileList files={legacy} revalidate={revalidate} canEdit={canEdit && !restricted} showName />
        </div>
      )}
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function FileList({ files, revalidate, canEdit, showName }: { files: DocFile[]; revalidate: string; canEdit: boolean; showName?: boolean }) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {files.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
          <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-primary hover:underline">{a.filename}</a>
          {showName && <span className="text-xs text-muted">{a.docType === "OTHER" ? "" : a.docType}</span>}
          {a.docNumber && <span className="tabular text-xs text-secondary">No. {a.docNumber}</span>}
          <span className="tabular text-xs text-muted">{a.expiryDate ? `expires ${shortDate(a.expiryDate)}` : "no expiry tracked"}</span>
          <span className="tabular text-xs text-subtle">added {shortDate(a.uploadedAt)}</span>
          {canEdit && <DeleteButton action={deleteAttachmentAction} hiddenFields={{ attachmentId: a.id, revalidate }} confirmMessage={`Delete "${a.filename}"?`} />}
        </li>
      ))}
    </ul>
  );
}

/** The upload form that opens under a row. The file is read as soon as it is chosen, and what was read is shown for checking. */
function RowUploader({ row, supplierId, revalidate, onDone }: { row: DocRow; supplierId: string; revalidate: string; onDone: () => void }) {
  const isOther = row.key === "OTHER";
  const [file, setFile] = useState<File | null>(null);
  const [expiry, setExpiry] = useState("");
  const [number, setNumber] = useState("");
  const [issue, setIssue] = useState("");
  const [name, setName] = useState("");
  const [track, setTrack] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function choose(f: File | undefined) {
    if (!f) return;
    setFile(f); setError(null); setWarn(null);
    if (isOther) {
      const guess = nameFromFile(f.name);
      setName((n) => n || guess);
      setNote("Reading the file…"); setReading(true);
      const read = await readOtherDoc(f);
      setReading(false);
      if (!read) { setNote(null); return; }
      setName((n) => (n === guess && read.name ? read.name : n));
      if (read.expiry) { setTrack(true); setExpiry((e) => e || read.expiry); }
      setNote(read.name || read.expiry ? "Filled in from the file. Check it before saving." : null);
      return;
    }
    if (row.key === "LETTERHEAD") return;
    setNote("Reading the file…"); setReading(true);
    const read = await readCompanyDoc(f);
    setReading(false);
    if (!read) { setNote("Couldn't read the file, so type the expiry date yourself."); return; }
    if (read.expiry) setExpiry(read.expiry);
    if (read.number) setNumber(read.number);
    if (read.issue) setIssue(read.issue);
    setNote(read.expiry || read.number || read.issue ? "Details read from the file. Check them before saving." : "Nothing could be read from the file. Type the details if it has them.");
    if (read.docType !== row.key && read.docType !== "OTHER") setWarn(`This looks like a different document (${read.docType.replace(/_/g, " ").toLowerCase()}). Check you chose the right row.`);
  }

  function save() {
    if (!file) { setError("Choose a file."); return; }
    if (isOther) { const why = otherDocProblem(name, track, expiry); if (why) { setError(why); return; } }
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("entityType", "SUPPLIER"); fd.set("entityId", supplierId); fd.set("revalidate", revalidate);
      fd.set("docType", row.key); fd.set("file", file);
      fd.set("expiryDate", isOther ? trackedExpiry(track, expiry) : expiry);
      if (!isOther) { fd.set("docNumber", number); fd.set("issueDate", issue); }
      if (isOther) fd.set("name", name.trim());
      const res = await uploadAttachment(fd);
      if (res?.error) setError(res.error);
      else onDone();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[14rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">File (max {MAX_UPLOAD_LABEL})</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" className="file-input" onChange={(e) => void choose(e.target.files?.[0])} />
        </label>
        {!isOther && row.key !== "LETTERHEAD" && (
          <label className="block w-56">
            <span className="mb-1 block text-xs font-medium text-muted">Number on the document</span>
            <input value={number} onChange={(e) => setNumber(e.target.value)} aria-label="Number on the document" className="input w-full" placeholder="Optional" />
          </label>
        )}
        {!isOther && row.hasExpiry && (
          <>
            <label className="block w-48">
              <span className="mb-1 block text-xs font-medium text-muted">Issue date</span>
              <DatePicker value={issue} onChange={setIssue} ariaLabel="Issue date" placeholder="dd/mm/yyyy" className="w-full" />
            </label>
            <label className="block w-48">
              <span className="mb-1 block text-xs font-medium text-muted">Expiry date</span>
              <DatePicker value={expiry} onChange={setExpiry} ariaLabel="Expiry date" placeholder="dd/mm/yyyy" className="w-full" />
            </label>
          </>
        )}
        <Button size="btn" type="button" disabled={pending || reading || !file} onClick={save} loading={pending}>{reading ? "Reading…" : "Save"}</Button>
      </div>
      {isOther && <OtherDocFields name={name} onName={setName} track={track} onTrack={setTrack} expiry={expiry} onExpiry={setExpiry} note={null} />}
      {note && <p className="flex items-center gap-1.5 text-xs text-muted">{reading && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}{note}</p>}
      {warn && <p role="status" className="text-xs text-[var(--warning)]">{warn}</p>}
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
    </div>
  );
}
