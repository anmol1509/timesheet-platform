"use client";

import { useState, useTransition } from "react";
import { setSupplierPortalAction } from "../actions";

export function PortalAccessCard({
  supplierId,
  enabled,
  canEdit,
  phones,
}: {
  supplierId: string;
  enabled: boolean;
  canEdit: boolean;
  phones: string[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function toggle() {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("supplierId", supplierId);
      fd.set("enabled", enabled ? "0" : "1");
      const res = await setSupplierPortalAction(fd);
      if (res.error) setError(res.error);
    });
  }
  return (
    <div className="card flex flex-wrap items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-primary">Supplier portal</h2>
        <p className="mt-1 text-xs text-muted">
          {enabled ? "On. " : "Off. "}
          Lets this supplier sign in at <span className="font-medium text-secondary">/vendor/login</span> with a code sent to one of the numbers below, to see their workers, timesheets and payments.
        </p>
        <p className="mt-1 text-xs text-muted">
          {phones.length > 0 ? `Numbers on file: ${phones.join(", ")}` : "No phone number is on file yet — add a contact, secondary or coordinator number first."}
        </p>
        {error && <p role="alert" className="mt-1 text-xs text-[var(--danger-text,#b42318)]">{error}</p>}
      </div>
      {canEdit && (
        <button type="button" className={enabled ? "btn btn-secondary" : "btn btn-primary"} disabled={pending || (!enabled && phones.length === 0)} onClick={toggle}>
          {pending ? "Saving…" : enabled ? "Turn off" : "Turn on"}
        </button>
      )}
    </div>
  );
}
