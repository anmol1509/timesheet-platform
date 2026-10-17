"use client";

import Link from "next/link";
import { Printer, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { COMPANY_LABEL, COMPANY_TYPES, buildCompanyCells, companyBadness, companyComplete, companyPrintIds, type CompanyAttachment, type CompanyCell, type CompanyKey, type CompanyState, type CompanySupplier } from "./company-docs";
import { PrintDialog } from "./print-dialog";
import { printDocuments } from "./print-docs";

const TONE: Record<CompanyState, string> = {
  valid: "bg-[var(--success-soft)] text-[var(--success)] border-transparent",
  expiring: "bg-[var(--warning-soft)] text-[var(--warning)] border-transparent",
  expired: "bg-[var(--error-soft)] text-[var(--error)] border-transparent",
  missing: "border-dashed border-[var(--border-strong,var(--border))] text-subtle",
  notlisted: "border-dashed border-[var(--warning)] text-[var(--warning)]",
  na: "border-transparent bg-surface-sunken text-subtle",
};

type Chip = "all" | "expired" | "expiring" | "missing" | "complete";

function Box({ cell, label, supplierId }: { cell: CompanyCell; label: string; supplierId: string }) {
  const inner = (<><span className="block text-[11px] font-semibold">{cell.label}</span><span className="block text-[10px] opacity-80">{cell.sub}</span></>);
  const cls = cn("inline-flex min-w-[5rem] flex-col items-center rounded-[10px] border px-2 py-1 leading-tight", TONE[cell.state]);
  // A document on file opens in a new tab; a missing one opens the supplier, where it can be added.
  // Several policies: the supplier page lists each one with the workers it covers.
  if ((cell.policies ?? 0) > 1) return <Link href={`/suppliers/${supplierId}#workmen-comp`} aria-label={`${label}: ${cell.sub}, ${cell.label}. Open the supplier to see each policy`} className={cn(cls, "hover:brightness-95")}>{inner}</Link>;
  if (cell.attachmentId) return <a href={`/api/attachments/${cell.attachmentId}`} target="_blank" rel="noreferrer" aria-label={`${label}: ${cell.label}, ${cell.sub}`} className={cn(cls, "cursor-pointer hover:brightness-95")}>{inner}</a>;
  if (cell.state === "na") return <span aria-label={`${label}: not needed`} className={cls}>{inner}</span>;
  return <Link href={`/suppliers/${supplierId}`} aria-label={`${label}: ${cell.label}. Open the supplier to add it`} className={cn(cls, "hover:brightness-95")}>{inner}</Link>;
}

/** One row per supplier company with its own documents: trade licence, VAT certificate, workmen comp and the rest. */
export function SupplierDocsView({ suppliers, attachments, certsInUse }: { suppliers: CompanySupplier[]; attachments: CompanyAttachment[]; certsInUse: string[] }) {
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<Chip>("all");
  const [sort, setSort] = useState<"worst" | "name">("worst");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);

  const cells = useMemo(() => buildCompanyCells(suppliers, attachments, now, new Set(certsInUse)), [suppliers, attachments, now, certsInUse]);
  const states = (id: string) => COMPANY_TYPES.map((t) => cells.get(id)![t.key].state);
  const matches = (id: string, c: Chip) => {
    const s = states(id);
    return c === "all" || (c === "expired" && s.includes("expired")) || (c === "expiring" && s.includes("expiring")) || (c === "missing" && s.includes("missing")) || (c === "complete" && s.every((x) => x === "valid" || x === "expiring" || x === "na"));
  };
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers.filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [suppliers, query]);
  const rows = useMemo(() => [...base.filter((s) => matches(s.id, chip))].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : companyBadness(cells.get(b.id)!) - companyBadness(cells.get(a.id)!) || a.name.localeCompare(b.name))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, chip, sort, cells]);

  const chosen = rows.filter((s) => selected.has(s.id));
  const allOn = rows.length > 0 && rows.every((s) => selected.has(s.id));
  const someOn = rows.some((s) => selected.has(s.id));
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chips: [Chip, string][] = [["all", "All suppliers"], ["expired", "With expired"], ["expiring", "Expiring soon"], ["missing", "With missing"], ["complete", "All in order"]];

  const options = COMPANY_TYPES.map((t) => ({
    key: t.key as string,
    label: t.label,
    have: chosen.filter((s) => cells.get(s.id)![t.key].attachmentId).length,
    of: chosen.filter((s) => cells.get(s.id)![t.key].state !== "na").length,
    note: t.key === "VAT" && chosen.some((s) => cells.get(s.id)!.VAT.state === "na") ? "some have no VAT no." : undefined,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search supplier…" aria-label="Search" className="input w-full pl-9" />
        </label>
        <div className="w-44"><Select value={sort} onChange={(v) => setSort(v as "worst" | "name")} searchable={false} options={[{ value: "worst", label: "Needs attention first" }, { value: "name", label: "Name A–Z" }]} /></div>
        <button type="button" onClick={() => setPrinting(true)} disabled={chosen.length === 0} className="btn btn-secondary gap-1.5"><Printer className="h-4 w-4" aria-hidden />Print…</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setChip(key)} className={cn("rounded-control border px-3 py-1.5 text-xs font-medium transition", chip === key ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default bg-surface text-secondary hover:bg-surface-hover")}>{label} ({base.filter((s) => matches(s.id, key)).length})</button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="w-10 px-4 py-3"><Checkbox checked={allOn} indeterminate={!allOn && someOn} onCheckedChange={(on) => setSelected(on ? new Set(rows.map((s) => s.id)) : new Set())} ariaLabel="Select all suppliers shown" /></th>
              <th className="px-2 py-3">Supplier</th>
              {COMPANY_TYPES.map((t) => <th key={t.key} className="px-2 py-3">{t.label}</th>)}
              <th className="px-4 py-3 text-right">In order</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const row = cells.get(s.id)!;
              const done = companyComplete(row);
              return (
                <tr key={s.id} className={cn("border-t border-default", selected.has(s.id) && "bg-brand-soft")}>
                  <td className="px-4 py-2.5"><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} ariaLabel={`Select ${s.name}`} /></td>
                  <td className="px-2 py-2.5"><Link href={`/suppliers/${s.id}`} className="font-medium text-primary hover:underline">{s.name}</Link>{s.trn && <span className="block text-xs text-subtle">TRN {s.trn}</span>}</td>
                  {COMPANY_TYPES.map((t) => <td key={t.key} className="px-1.5 py-2"><Box cell={row[t.key as CompanyKey]} label={`${s.name} ${COMPANY_LABEL[t.key]}`} supplierId={s.id} /></td>)}
                  <td className="px-4 py-2.5 text-right tabular text-secondary"><b>{done.ok}</b> of {done.of}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No suppliers match.</p>}
      </div>
      <p className="text-xs text-muted">Click a coloured box to open that document. Click a dashed box to go to the supplier and add it. A supplier with no VAT number shows “Not needed” for the VAT certificate.</p>

      {chosen.length > 0 && (
        <div className="sticky bottom-4 z-20 flex justify-center">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#1e1b3a] py-2.5 pr-2.5 pl-4 text-sm text-white shadow-modal">
            <b className="mr-1">{chosen.length} selected</b>
            <button type="button" onClick={() => setPrinting(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10"><Printer className="h-3.5 w-3.5" aria-hidden />Print…</button>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white">Clear</button>
          </div>
        </div>
      )}

      <PrintDialog
        open={printing}
        onOpenChange={setPrinting}
        title="Print supplier documents"
        subject={`${chosen.length} ${chosen.length === 1 ? "supplier" : "suppliers"}`}
        options={options}
        count={(keys) => { const r = companyPrintIds(chosen.map((s) => s.id), keys as CompanyKey[], cells); return { printing: r.ids.length, missing: r.missing }; }}
        onPrint={(keys) => printDocuments(companyPrintIds(chosen.map((s) => s.id), keys as CompanyKey[], cells).ids)}
      />
    </div>
  );
}
