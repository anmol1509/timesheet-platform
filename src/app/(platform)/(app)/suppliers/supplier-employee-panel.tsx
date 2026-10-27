"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Tooltip } from "@/components/ui/Tooltip";
import { Badge } from "@/components/Badge";
import { getSupplierPanelAction, type SupplierPanel } from "./actions";
import { WorkmenCompPanel } from "./[id]/workmen-comp-panel";

/**
 * A supplier's people, and the workmen's compensation covering them.
 *
 * Opened from the supplier list and My Companies. It shows who is on the books for this company, and the certificates
 * on file with who is on each: a certificate that is uploaded has its names matched to the company's workers and
 * linked straight away (the file is then filed on each worker), names that are close to a worker are offered as a
 * match, and a name nobody matches can be added as an employee with one click. The same section as on the company page.
 */
export function SupplierEmployeePanel({
  supplierId,
  supplierName,
  canEdit = true,
}: {
  supplierId: string;
  supplierName: string;
  /** Kept for callers that still pass them; the registration form is no longer opened from here. */
  supplierBranchId?: string | null;
  wizardData?: unknown;
  /** Whether the viewer may change workmen compensation; the server checks it again on every change. */
  canEdit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<SupplierPanel | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Loading state is set inside the promise chain rather than synchronously,
    // so opening the dialog doesn't schedule a cascading render.
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return getSupplierPanelAction(supplierId);
      })
      .then((data) => {
        if (!cancelled) setPanel(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, supplierId]);

  function refreshPanel() {
    getSupplierPanelAction(supplierId).then(setPanel);
  }

  return (
    <>
      <Tooltip label={`Employees & insurance: ${supplierName}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Employee panel for ${supplierName}`}
          className="rounded-control border border-default p-1.5 text-subtle transition hover:bg-surface-hover hover:text-secondary"
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
        </button>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={`${supplierName}: employees & insurance`}
          description="Who is on the books for this supplier, and who each workmen's compensation certificate covers."
          className="max-w-4xl"
        >
          <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
            {loading && (
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…
              </p>
            )}

            {panel && (
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  Employees ({panel.employees.length})
                </h3>
                {panel.employees.length === 0 ? (
                  <p className="rounded-card border border-default px-3 py-6 text-center text-sm text-muted">
                    Nobody is linked to this supplier yet.
                  </p>
                ) : (
                  <ul className="max-h-56 divide-y divide-[var(--border)] overflow-y-auto rounded-card border border-default">
                    {panel.employees.map((e) => (
                      <li key={e.id} className="flex items-center gap-2.5 px-3 py-2">
                        <Link
                          href={`/employees/${e.id}`} target="_blank" rel="noopener noreferrer"
                          className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
                        >
                          {e.name}
                          <span className="tabular ml-2 text-xs text-subtle">
                            {e.employeeIdNo}
                          </span>
                        </Link>
                        <span className="text-xs text-muted">{e.trade || "No trade"}</span>
                        {!e.active && <Badge color="slate">Inactive</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Workmen&rsquo;s compensation</h3>
              <WorkmenCompPanel supplierId={supplierId} canEdit={canEdit} onChanged={refreshPanel} />
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
