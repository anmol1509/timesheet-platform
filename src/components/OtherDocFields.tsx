"use client";

import { DatePicker } from "@/components/ui/DatePicker";

/**
 * The three details every "Other document" asks for, the same in every module: a name, whether to track its expiry, and the
 * expiry date (only asked when tracked). `note` says where the values came from ("Reading the file…", "Filled in from the file").
 */
export function OtherDocFields({ name, onName, track, onTrack, expiry, onExpiry, disabled, note, fileLabel, className }: {
  name: string; onName: (v: string) => void;
  track: boolean; onTrack: (v: boolean) => void;
  expiry: string; onExpiry: (v: string) => void;
  disabled?: boolean; note?: string | null; fileLabel?: string; className?: string;
}) {
  return (
    <div className={className ?? "grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_14rem]"}>
      <label className="block min-w-0">
        <span className="mb-1 block text-xs font-medium text-muted">Name{fileLabel ? <span className="font-normal"> ({fileLabel})</span> : null}</span>
        <input value={name} onChange={(e) => onName(e.target.value)} disabled={disabled} placeholder="e.g. Fire safety certificate" className="input w-full" />
      </label>
      <label className="flex h-9 items-center gap-2 text-sm text-primary">
        <input type="checkbox" checked={track} onChange={(e) => onTrack(e.target.checked)} disabled={disabled} className="h-4 w-4 accent-[var(--brand-primary)]" />
        Track expiry
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Expiry date</span>
        <DatePicker value={expiry} onChange={onExpiry} disabled={disabled || !track} ariaLabel="Expiry date" placeholder={track ? "dd/mm/yyyy" : "not tracked"} className="w-full" />
      </label>
      {note && <p className="text-xs text-muted sm:col-span-3">{note}</p>}
    </div>
  );
}
