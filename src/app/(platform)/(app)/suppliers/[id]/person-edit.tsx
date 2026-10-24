"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { NewPerson } from "@/components/PersonPicker";
import { updatePartyAction } from "./party-actions";

/** Edit a person's details once; it changes for every company they are linked to. */
export function PersonEdit({ supplierId, partyId, initial, otherCompanies }: { supplierId: string; partyId: string; initial: NewPerson; otherCompanies: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <button type="button" className="text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setOpen(true)}>Edit details</button>;
  return (
    <div className="mt-2 w-full space-y-2 rounded-xl bg-surface-sunken p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className="input w-full" placeholder="Full name *" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label="Full name" />
        <input className="input w-full" placeholder="Nationality" value={v.nationality} onChange={(e) => setV({ ...v, nationality: e.target.value })} aria-label="Nationality" />
        <input className="input w-full" placeholder="Phone" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} aria-label="Phone" />
        <input className="input w-full" type="email" placeholder="Email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} aria-label="Email" />
      </div>
      {otherCompanies > 0 && <p className="text-xs text-muted">This person is also linked to {otherCompanies} other {otherCompanies === 1 ? "company" : "companies"}; the change applies to all of them.</p>}
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => start(async () => { const r = await updatePartyAction({ supplierId, partyId, ...v }); if (r.error) return setError(r.error); setOpen(false); router.refresh(); })}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setV(initial); setError(null); setOpen(false); }}>Cancel</button>
      </div>
    </div>
  );
}
