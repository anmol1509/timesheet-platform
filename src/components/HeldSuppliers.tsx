"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { approveSupplierForLabourAction, heldSuppliersAction, type HeldRow } from "@/app/(platform)/(app)/suppliers/hold-actions";

/** Suppliers holding workers back, each with the way to release them. Shown wherever someone is about to need those workers. */
export function HeldSuppliersList({ rows, canApprove, heading, onApproved }: { rows: HeldRow[]; canApprove: boolean; heading: string; onApproved?: () => void }) {
  const router = useRouter();
  if (rows.length === 0) return null;
  return (
    <section className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3 text-sm" aria-label="Suppliers waiting for approval">
      <p className="flex items-start gap-2 font-medium text-[var(--warning)]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{heading}</span>
      </p>
      <ul className="mt-2 divide-y divide-[var(--warning-border)]">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
            <div className="min-w-0 flex-1">
              <Link href={`/suppliers/${r.id}`} className="font-medium text-primary hover:underline">{r.name}</Link>
              <span className="ml-2 text-xs text-secondary">{r.workers} idle worker{r.workers === 1 ? "" : "s"} waiting</span>
              <p className="text-xs text-secondary">
                {r.detail}
                {r.needs.length > 0 && <> · {r.needs.join(" · ")}</>}
              </p>
            </div>
            {canApprove ? (
              <ConfirmDialog
                danger={false}
                title={`Approve ${r.name}?`}
                description={`This approves the supplier and its labour, so its ${r.workers} idle worker${r.workers === 1 ? "" : "s"} can be mobilised. Anything already rejected stays as it is.`}
                confirmLabel="Approve"
                onConfirm={async () => {
                  const res = await approveSupplierForLabourAction(r.id);
                  if (res.error) return res;
                  onApproved?.();
                  router.refresh();
                }}
                trigger={(open) => <button type="button" onClick={open} className="btn btn-secondary btn-sm">Approve</button>}
              />
            ) : (
              <Link href={`/suppliers/${r.id}`} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Ask an approver</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The held-back suppliers for this branch, fetched when it appears; renders nothing when none are held. Used on the import summary. */
export function ImportHeldNotice() {
  const [data, setData] = useState<{ rows: HeldRow[]; canApprove: boolean } | null>(null);
  const load = () => { void heldSuppliersAction().then(setData).catch(() => setData(null)); };
  useEffect(() => { load(); }, []);
  if (!data || data.rows.length === 0) return null;
  const workers = data.rows.reduce((n, r) => n + r.workers, 0);
  return (
    <HeldSuppliersList
      rows={data.rows}
      canApprove={data.canApprove}
      onApproved={load}
      heading={`${workers} idle worker${workers === 1 ? "" : "s"} can't be mobilised yet: ${data.rows.length === 1 ? "their supplier isn't" : `${data.rows.length} suppliers aren't`} approved. Approve ${data.rows.length === 1 ? "it" : "them"} before these workers can be put on a demand.`}
    />
  );
}
