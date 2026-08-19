"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { Tooltip } from "@/components/ui/Tooltip";
import { UPLOAD_ACCEPT_ATTR } from "@/lib/uploads";
import type { ExtractedEmployeeRow } from "@/app/api/documents/extract-employees/route";
import { EmployeeWizard } from "@/app/(app)/employees/new/wizard";

type WizardData = {
  projects: { id: string; name: string; code: string; clientId: string }[];
  suppliers: { id: string; name: string }[];
  sponsorshipCompanies: { id: string; name: string }[];
  lookups: Record<string, { value: string }[]>;
};

type ScannedRow = ExtractedEmployeeRow & { include: boolean };

/**
 * Reads a workmen's-compensation certificate from the supplier list and turns
 * the names on it into employees.
 *
 * The certificate covers everyone the supplier insures, which is not the same
 * set as the people working for us — so every name is a checkbox, off by
 * default for nobody and reviewed by hand. Registering happens in a dialog
 * rather than a full-page wizard, because you're working through a list and
 * being thrown out to another screen for each name loses your place.
 */
export function WciScanDialog({
  supplierId,
  supplierName,
  wizardData,
}: {
  supplierId: string;
  supplierName: string;
  wizardData: WizardData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ScannedRow[] | null>(null);
  const [adding, setAdding] = useState<ScannedRow | null>(null);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function scan(file: File) {
    setScanning(true);
    setError(null);
    setRows(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/documents/extract-employees", {
        method: "POST",
        body,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Could not read that certificate.");
        return;
      }
      const found = (json.employees || []) as ExtractedEmployeeRow[];
      if (found.length === 0) {
        setError("No names could be read from that file.");
        return;
      }
      setRows(found.map((r) => ({ ...r, include: true })));
    } catch {
      setError("Could not read that certificate.");
    } finally {
      setScanning(false);
    }
  }

  const included = rows?.filter((r) => r.include) ?? [];

  return (
    <>
      <Tooltip label={`Upload workmen's compensation for ${supplierName}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Upload workmen's compensation for ${supplierName}`}
          className="rounded-control border border-default p-1.5 text-subtle transition hover:bg-surface-hover hover:text-secondary"
        >
          <FileUp className="h-3.5 w-3.5" aria-hidden />
        </button>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={`Workmen's compensation — ${supplierName}`}
          description="Upload the certificate and pick which of the insured names are ours."
        >
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_ACCEPT_ATTR}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void scan(file);
            }}
            className="file-input"
          />

          {scanning && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Reading the certificate…
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {rows && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {included.length} of {rows.length} selected
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setRows((prev) =>
                      prev!.map((r) => ({ ...r, include: included.length !== rows.length }))
                    )
                  }
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  {included.length === rows.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <ul className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto rounded-card border border-default">
                {rows.map((row, i) => (
                  <li key={i} className="flex items-center gap-2.5 px-3 py-2">
                    <Checkbox
                      checked={row.include}
                      onCheckedChange={() =>
                        setRows((prev) =>
                          prev!.map((r, idx) =>
                            idx === i ? { ...r, include: !r.include } : r
                          )
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-primary">
                        {row.name || <span className="text-subtle">Unnamed</span>}
                      </span>
                      {(row.designation || row.salary) && (
                        <span className="block truncate text-xs text-subtle">
                          {[row.designation, row.salary].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={!row.include || !row.name}
                      onClick={() => setAdding(row)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-control border border-default px-2 py-1 text-xs font-medium text-secondary transition hover:bg-surface-hover disabled:opacity-40"
                    >
                      <UserPlus className="h-3.5 w-3.5" aria-hidden />
                      Add employee
                    </button>
                  </li>
                ))}
              </ul>

              <p className="mt-2 text-xs text-subtle">
                Names come off the certificate as printed — check them before adding,
                since the insurer&rsquo;s list usually covers more people than work for
                us.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* The full registration flow, in a dialog so working through a list of
          scanned names doesn't mean leaving the page for each one. */}
      <Dialog open={!!adding} onOpenChange={(v) => !v && setAdding(null)}>
        <DialogContent
          title={`Register ${adding?.name ?? "employee"}`}
          description={`Added against ${supplierName}. Everything is pre-filled from the certificate where it could be read.`}
          className="max-w-5xl"
        >
          {adding && (
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <EmployeeWizard
                {...wizardData}
                prefill={{
                  name: adding.name ?? "",
                  supplierId,
                  position: adding.designation ?? "",
                }}
                onRegistered={() => {
                  // Tick the name off the list rather than leaving it looking
                  // like nothing happened.
                  setRows((prev) =>
                    prev!.filter((r) => r !== adding)
                  );
                  setAdding(null);
                  startTransition(() => router.refresh());
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
