"use client";

import { useRef, useState } from "react";
import { Select } from "@/components/ui/Select";
import { saveDocumentTypeAction } from "./actions";

export type TypeFormValues = { appliesTo: string; key?: string; label: string; hasExpiry: boolean; required: string; reminderDays: string; isActive: boolean };

const REQUIRED_OPTIONS = [
  { value: "NO", label: "Optional" },
  { value: "YES", label: "Required" },
  { value: "OWN_COMPANY", label: "Required for own company" },
];

/** Adds a custom type (no `key`) or edits one in place. */
export function DocumentTypeForm({ initial, onDone }: { initial: TypeFormValues; onDone?: () => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiry, setExpiry] = useState(initial.hasExpiry);
  const isCompany = initial.appliesTo === "SUPPLIER";
  return (
    <form
      ref={ref}
      action={async (fd) => {
        setError(null);
        const r = await saveDocumentTypeAction(fd);
        if (r.error) return setError(r.error);
        if (!initial.key) ref.current?.reset();
        onDone?.();
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="appliesTo" value={initial.appliesTo} />
      {initial.key && <input type="hidden" name="key" value={initial.key} />}
      {!initial.isActive && <input type="hidden" name="isActive" value="off" />}
      <label className="block min-w-[200px] flex-1">
        <span className="mb-1 block text-xs font-medium text-muted">Name</span>
        <input name="label" required defaultValue={initial.label} className="input w-full" placeholder="e.g. Pest control certificate" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Required?</span>
        <Select name="required" defaultValue={initial.required} options={isCompany ? REQUIRED_OPTIONS : REQUIRED_OPTIONS.slice(0, 2)} />
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" name="hasExpiry" checked={expiry} onChange={(e) => setExpiry(e.target.checked)} /> Has an expiry date
      </label>
      {expiry && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Remind (days before)</span>
          <input name="reminderDays" defaultValue={initial.reminderDays} className="input w-36" placeholder="90, 60, 30, 7" />
        </label>
      )}
      <button type="submit" className="btn btn-primary">{initial.key ? "Save" : "Add type"}</button>
      {error && <p className="w-full text-sm text-[var(--error)]">{error}</p>}
    </form>
  );
}
