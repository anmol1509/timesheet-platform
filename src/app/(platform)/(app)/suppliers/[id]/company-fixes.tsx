"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCompanyHeaderFieldsAction } from "../actions";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
const FIELDS: { gap: string; key: "trn" | "location" | "phone" | "contactEmail"; label: string; placeholder: string }[] = [
  { gap: "TRN", key: "trn", label: "TRN (15 digits)", placeholder: "100000000000003" },
  { gap: "address", key: "location", label: "Address", placeholder: "Office, area" },
  { gap: "phone", key: "phone", label: "Phone", placeholder: "+971 4 123 4567" },
  { gap: "email", key: "contactEmail", label: "Email", placeholder: "office@company.com" },
];

/** What a timesheet header is missing, as boxes to fill in right here. The logo is uploaded under Logo on this page. */
export function HeaderFix({ supplierId, gaps, canEdit }: { supplierId: string; gaps: string[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const open = FIELDS.filter((f) => gaps.includes(f.gap));
  function save() {
    setError(null);
    start(async () => {
      const r = await setCompanyHeaderFieldsAction(supplierId, { trn: v.trn, location: v.location, phone: v.phone, contactEmail: v.contactEmail });
      if (r.error) { setError(r.error); return; }
      setV({});
      router.refresh();
    });
  }
  return (
    <div className="space-y-3 text-sm">
      {open.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {open.map((f) => (
            <label key={f.key} className="block text-xs text-muted">{f.label}
              <input value={v[f.key] ?? ""} onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} disabled={!canEdit} className="input mt-1 h-9 w-full text-sm" />
            </label>
          ))}
        </div>
      )}
      {gaps.includes("logo") && <p className="text-xs text-muted">The logo is uploaded under <span className="font-medium text-primary">Logo, signatory, signature &amp; stamp</span> lower on this page.</p>}
      {open.length > 0 && canEdit && (
        <div className="flex items-center gap-3">
          <Button size="btn-sm" type="button" disabled={pending} onClick={save} loading={pending}>Save</Button>
          {error && <Alert inline>{error}</Alert>}
        </div>
      )}
    </div>
  );
}
