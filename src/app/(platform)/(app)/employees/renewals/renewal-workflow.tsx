"use client";

import { useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Download, Pencil, UserRound } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { RENEWAL_STATUSES, type RenewalStatus } from "@/lib/renewalCases";

export type Owner = { id: string; name: string };

const STATUS_STYLE: Record<RenewalStatus, string> = {
  NOT_STARTED: "bg-surface-sunken text-muted",
  IN_PROGRESS: "bg-info-soft text-[var(--info)]",
  SUBMITTED: "bg-brand-soft text-brand",
  DONE: "bg-success-soft text-[var(--success)]",
};

type MenuItem = { key: string; label: string; selected?: boolean; onSelect: () => void };

/** A small pop-up list of choices opened from any trigger. */
function Menu({ trigger, items, label, disabled }: { trigger: React.ReactNode; items: MenuItem[]; label: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  if (disabled) return <>{trigger}</>;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={label} onClick={(e) => e.stopPropagation()} className="rounded-full focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:outline-none">{trigger}</button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} onClick={(e) => e.stopPropagation()} className="z-50 max-h-72 min-w-44 overflow-y-auto rounded-xl border border-default bg-surface p-1 shadow-modal outline-none">
          {items.map((it) => (
            <button key={it.key} type="button" onClick={() => { setOpen(false); it.onSelect(); }} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-sm text-primary hover:bg-surface-hover">
              {it.label}
              {it.selected && <Check className="h-4 w-4 text-brand" aria-hidden />}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export const statusLabel = (s: RenewalStatus) => RENEWAL_STATUSES.find((x) => x.key === s)!.label;

export function StatusChip({ value, onChange, disabled }: { value: RenewalStatus; onChange: (s: RenewalStatus) => void; disabled?: boolean }) {
  const chip = (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", STATUS_STYLE[value])}>
      {statusLabel(value)}
      {!disabled && <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />}
    </span>
  );
  return <Menu label="Change status" disabled={disabled} trigger={chip} items={RENEWAL_STATUSES.map((s) => ({ key: s.key, label: s.label, selected: s.key === value, onSelect: () => onChange(s.key) }))} />;
}

export function OwnerCell({ ownerId, ownerName, owners, onChange, disabled, currentUserId }: { ownerId: string | null; ownerName: string | null; owners: Owner[]; onChange: (id: string | null) => void; disabled?: boolean; currentUserId?: string }) {
  const shown = ownerName ? (
    <span className="inline-flex items-center gap-1.5 text-sm text-primary">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">{ownerName.slice(0, 1).toUpperCase()}</span>
      <span className="max-w-[7rem] truncate">{ownerName}</span>
      {!disabled && <ChevronDown className="h-3 w-3 text-subtle" aria-hidden />}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-sm text-subtle"><UserRound className="h-3.5 w-3.5" aria-hidden />{disabled ? "—" : "Assign"}{!disabled && <ChevronDown className="h-3 w-3" aria-hidden />}</span>
  );
  const items: MenuItem[] = [
    ...(currentUserId && owners.some((o) => o.id === currentUserId) && ownerId !== currentUserId ? [{ key: "me", label: "Assign to me", onSelect: () => onChange(currentUserId) }] : []),
    ...owners.map((o) => ({ key: o.id, label: o.name, selected: o.id === ownerId, onSelect: () => onChange(o.id) })),
    ...(ownerId ? [{ key: "none", label: "Unassign", onSelect: () => onChange(null) }] : []),
  ];
  return <Menu label="Change owner" disabled={disabled} trigger={shown} items={items} />;
}

/** A short line of text kept with a renewal: click to write, Enter or click away to save, Esc to cancel. */
export function NoteCell({ value, onSave, disabled }: { value: string | null; onSave: (note: string | null) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const done = useRef(false);
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={300}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { done.current = true; setEditing(false); }
        }}
        onBlur={() => {
          if (!done.current && draft.trim() !== (value ?? "")) onSave(draft.trim() || null);
          done.current = false;
          setEditing(false);
        }}
        aria-label="Note"
        className="input h-8 w-full min-w-[10rem] py-0 text-xs"
      />
    );
  }
  if (disabled) return <span className="text-xs text-muted">{value ?? "—"}</span>;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); setDraft(value ?? ""); setEditing(true); }} className="group flex max-w-[13rem] items-center gap-1 text-left text-xs">
      {value ? <span className="truncate text-secondary" title={value}>{value}</span> : <span className="text-subtle group-hover:text-muted">+ Add note</span>}
      <Pencil className="h-3 w-3 shrink-0 text-subtle opacity-0 group-hover:opacity-100" aria-hidden />
    </button>
  );
}

/** The state of the work across the queue: a count per status, and a way to see only your own. */
export function ProgressStrip({ counts, status, onStatus, mine, onMine, mineCount }: { counts: Record<RenewalStatus, number>; status: RenewalStatus | ""; onStatus: (s: RenewalStatus | "") => void; mine: boolean; onMine: (v: boolean) => void; mineCount: number }) {
  return (
    <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-3 sm:px-4">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">Progress</span>
      {RENEWAL_STATUSES.map((s) => {
        const on = status === s.key;
        return (
          <button key={s.key} type="button" aria-pressed={on} onClick={() => onStatus(on ? "" : s.key)} className={cn("flex items-baseline gap-1.5 rounded-lg px-2 py-1 text-sm transition hover:bg-surface-hover", on && "bg-brand-soft")}>
            <span className={cn("tabular text-lg font-semibold", s.key === "DONE" ? "text-[var(--success)]" : s.key === "SUBMITTED" ? "text-brand" : s.key === "IN_PROGRESS" ? "text-[var(--info)]" : "text-secondary")}>{counts[s.key]}</span>
            <span className="text-muted">{s.label}</span>
          </button>
        );
      })}
      <button type="button" aria-pressed={mine} onClick={() => onMine(!mine)} className={cn("ml-auto rounded-full px-3 py-1 text-xs font-semibold transition", mine ? "bg-[var(--brand-primary)] text-white" : "bg-brand-soft text-brand hover:opacity-80")}>My renewals · {mineCount}</button>
    </div>
  );
}

export function BulkBar({ count, owners, currentUserId, onStatus, onOwner, onExport, onClear, canExport }: { count: number; owners: Owner[]; currentUserId: string; onStatus: (s: RenewalStatus) => void; onOwner: (id: string | null) => void; onExport: () => void; onClear: () => void; canExport: boolean }) {
  const btn = "inline-flex items-center gap-1 rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-primary shadow-sm hover:bg-surface-hover";
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-default bg-brand-soft px-4 py-2.5 text-sm">
      <span className="font-semibold text-brand">{count} selected</span>
      <Menu label="Assign owner" trigger={<span className={btn}>Assign owner <ChevronDown className="h-3 w-3" aria-hidden /></span>} items={[...(owners.some((o) => o.id === currentUserId) ? [{ key: "me", label: "Assign to me", onSelect: () => onOwner(currentUserId) }] : []), ...owners.map((o) => ({ key: o.id, label: o.name, onSelect: () => onOwner(o.id) })), { key: "none", label: "Unassign", onSelect: () => onOwner(null) }]} />
      <Menu label="Set status" trigger={<span className={btn}>Set status <ChevronDown className="h-3 w-3" aria-hidden /></span>} items={RENEWAL_STATUSES.map((s) => ({ key: s.key, label: s.label, onSelect: () => onStatus(s.key) }))} />
      {canExport && <button type="button" onClick={onExport} className={btn}><Download className="h-3.5 w-3.5" aria-hidden /> Export for PRO</button>}
      <button type="button" onClick={onClear} className="ml-auto text-xs font-medium text-brand hover:underline">Clear selection</button>
    </div>
  );
}

export type ExportChoice = { key: string; label: string; count: number };

/** Which renewals go into the sheet for the PRO. */
export function ExportDialog({ open, onOpenChange, choices, busy, error, onExport }: { open: boolean; onOpenChange: (o: boolean) => void; choices: ExportChoice[]; busy: boolean; error: string | null; onExport: (key: string) => void }) {
  const available = choices.filter((c) => c.count > 0);
  const [picked, setPicked] = useState<string | null>(null);
  const current = available.find((c) => c.key === picked)?.key ?? available[0]?.key ?? "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Export for PRO" description="One Excel sheet for whoever processes the renewals: who, which document, its number and expiry, and what is already in hand." className="max-w-lg">
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Which renewals</p>
            {available.length === 0 ? (
              <p className="text-sm text-muted">There is nothing to export yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {available.map((c) => (
                  <button key={c.key} type="button" aria-pressed={current === c.key} onClick={() => setPicked(c.key)} className={cn("rounded-full border px-3 py-1.5 text-sm transition", current === c.key ? "border-[var(--brand-primary)] bg-brand-soft font-semibold text-brand" : "border-default text-secondary hover:bg-surface-hover")}>
                    {c.label} <span className="tabular text-xs opacity-70">({c.count})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <ul className="space-y-1 text-sm text-secondary">
            <li>Name, ID, nationality, passport number and Emirates ID</li>
            <li>The document, its number and expiry date</li>
            <li>Project and supplier, and the status, owner and note</li>
          </ul>
          <p className="text-xs text-muted">Grouped by document type, soonest first. Salary is never included.</p>
          {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => onOpenChange(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy || !current} onClick={() => onExport(current)}><Download className="h-4 w-4" aria-hidden /> {busy ? "Preparing…" : "Download Excel"}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
