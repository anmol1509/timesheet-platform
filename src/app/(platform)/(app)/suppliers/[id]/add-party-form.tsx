"use client";

import { useRef, useState } from "react";
import { Select } from "@/components/ui/Select";
import { PARTY_ROLES } from "@/lib/documentTypes";
import { addSupplierPartyAction } from "./party-actions";

export function AddPartyForm({ supplierId }: { supplierId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        setError(null);
        const r = await addSupplierPartyAction(fd);
        if (r.error) setError(r.error);
        else ref.current?.reset();
      }}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-strong p-4"
    >
      <input type="hidden" name="supplierId" value={supplierId} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Role</span>
        <Select name="role" defaultValue="OWNER" options={PARTY_ROLES.map((r) => ({ value: r.value, label: r.label }))} />
      </label>
      <label className="block min-w-[180px] flex-1">
        <span className="mb-1 block text-xs font-medium text-muted">Name</span>
        <input name="name" required className="input w-full" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Nationality</span>
        <input name="nationality" className="input w-36" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Phone</span>
        <input name="phone" className="input w-36" />
      </label>
      <button type="submit" className="btn btn-primary">Add</button>
      {error && <p className="w-full text-sm text-[var(--error)]">{error}</p>}
    </form>
  );
}
