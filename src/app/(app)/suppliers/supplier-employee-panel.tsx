"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Users, UserPlus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { Tooltip } from "@/components/ui/Tooltip";
import { Badge } from "@/components/Badge";
import { UPLOAD_ACCEPT_ATTR } from "@/lib/uploads";
import { MAX_UPLOAD_LABEL } from "@/lib/constants";
import { matchTrade } from "@/lib/trades";
import { daysUntil } from "@/lib/compliance";
import { uploadAttachmentAction } from "@/lib/attachments";
import type { ExtractedEmployeeRow } from "@/app/api/documents/extract-employees/route";
import { EmployeeWizard } from "@/app/(app)/employees/new/wizard";
import {
  getSupplierPanelAction,
  matchInsuredNamesAction,
  type InsuredNameMatch,
  type SupplierPanel,
} from "./actions";

type WizardData = {
  projects: { id: string; name: string; code: string; clientId: string }[];
  suppliers: { id: string; name: string }[];
  sponsorshipCompanies: { id: string; name: string }[];
  lookups: Record<string, { value: string }[]>;
};

type ScannedRow = ExtractedEmployeeRow & {
  include: boolean;
  match?: InsuredNameMatch;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * A supplier's people, and the insurance covering them.
 *
 * Opened from the supplier list. It shows who is already on the books for this
 * company, the workmen's-compensation certificates on file with their expiry
 * dates, and — when a new certificate is uploaded — the names read off it,
 * checked against the roster so a renewal doesn't re-add the workforce.
 *
 * Certificates are a list rather than a single file because a new one is issued
 * every renewal, and knowing which one has lapsed is the point.
 */
export function SupplierEmployeePanel({
  supplierId,
  supplierName,
  supplierBranchId,
  wizardData,
}: {
  supplierId: string;
  supplierName: string;
  supplierBranchId: string | null;
  wizardData: WizardData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<SupplierPanel | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ScannedRow[] | null>(null);
  const [adding, setAdding] = useState<ScannedRow | null>(null);
  const [expiry, setExpiry] = useState("");
  const [, startTransition] = useTransition();

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

  async function handleFile(file: File) {
    setScanning(true);
    setError(null);
    setRows(null);
    try {
      // Filed against the supplier first: the certificate is a document in its
      // own right, and it stays on record whether or not anyone is added from it.
      const upload = new FormData();
      upload.append("entityType", "SUPPLIER");
      upload.append("entityId", supplierId);
      upload.append("entityBranchId", supplierBranchId ?? "");
      upload.append("docType", "WORKMEN_COMPENSATION_INSURANCE");
      upload.append("expiryDate", expiry);
      upload.append("revalidate", "/suppliers");
      upload.append("file", file);
      await uploadAttachmentAction(upload);
      refreshPanel();

      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/documents/extract-employees", {
        method: "POST",
        body,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Saved the certificate, but couldn't read names from it.");
        return;
      }
      const found = (json.employees || []) as ExtractedEmployeeRow[];
      if (found.length === 0) {
        setError("Saved the certificate, but no names could be read from it.");
        return;
      }

      const matches = await matchInsuredNamesAction(
        supplierId,
        found.map((r) => r.name ?? "")
      );
      setRows(
        found.map((r, i) => ({
          ...r,
          match: matches[i],
          include: matches[i]?.status === "new",
        }))
      );
    } catch {
      setError("Could not read that certificate.");
    } finally {
      setScanning(false);
    }
  }

  const included = rows?.filter((r) => r.include) ?? [];
  const alreadyHeld = rows?.filter((r) => r.match && r.match.status !== "new").length ?? 0;

  return (
    <>
      <Tooltip label={`Employees & insurance — ${supplierName}`}>
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
          title={`${supplierName} — employees & insurance`}
          description="Who is on the books for this supplier, and the workmen's compensation covering them."
          className="max-w-3xl"
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
                          href={`/employees/${e.id}`}
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

            {panel && (
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  Workmen&rsquo;s compensation ({panel.certificates.length})
                </h3>
                {panel.certificates.length > 0 && (
                  <ul className="mb-3 divide-y divide-[var(--border)] rounded-card border border-default">
                    {panel.certificates.map((c) => {
                      const days = c.expiryDate ? daysUntil(new Date(c.expiryDate)) : null;
                      return (
                        <li key={c.id} className="flex items-center gap-2.5 px-3 py-2">
                          <a
                            href={`/api/attachments/${c.id}`}
                            className="min-w-0 flex-1 truncate text-sm text-blue-600 hover:underline"
                          >
                            {c.filename}
                          </a>
                          <span className="text-xs text-subtle">
                            uploaded {fmt(c.uploadedAt)}
                          </span>
                          {c.expiryDate ? (
                            <Badge
                              color={
                                days !== null && days < 0
                                  ? "red"
                                  : days !== null && days <= 30
                                    ? "amber"
                                    : "green"
                              }
                            >
                              {days !== null && days < 0
                                ? `Expired ${fmt(c.expiryDate)}`
                                : `Expires ${fmt(c.expiryDate)}`}
                            </Badge>
                          ) : (
                            <Badge color="slate">No expiry set</Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="rounded-card border border-default p-3">
                  <label className="mb-2 block">
                    <span className="mb-1 block text-xs font-medium text-muted">
                      Expiry of the certificate you&rsquo;re uploading
                    </span>
                    <input
                      type="date"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      className="input w-48"
                    />
                  </label>
                  <input
                    type="file"
                    accept={UPLOAD_ACCEPT_ATTR}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFile(file);
                      e.target.value = "";
                    }}
                    className="file-input"
                  />
                  <p className="mt-1 text-xs text-subtle">
                    Max {MAX_UPLOAD_LABEL}. The certificate is filed against this supplier
                    and its names are read so they can be added below.
                  </p>
                </div>

                {scanning && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Saving and reading the certificate…
                  </p>
                )}
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              </section>
            )}

            {rows && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                    Names on the certificate — {included.length} of {rows.length} selected
                    {alreadyHeld > 0 && (
                      <span className="ml-2 font-normal text-[var(--success)] normal-case">
                        {alreadyHeld} already on the roster
                      </span>
                    )}
                  </h3>
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

                <ul className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto rounded-card border border-default">
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
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm text-primary">
                            {row.name || <span className="text-subtle">Unnamed</span>}
                          </span>
                          {row.match?.status === "exists_here" && (
                            <span className="shrink-0 rounded-control bg-[var(--success-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--success)]">
                              Already added
                            </span>
                          )}
                          {row.match?.status === "exists_elsewhere" && (
                            <span className="shrink-0 rounded-control bg-[var(--warning-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--warning)]">
                              Same name elsewhere
                            </span>
                          )}
                        </span>
                        {row.match && row.match.matches.length > 0 ? (
                          <span className="block truncate text-xs text-subtle">
                            {row.match.matches
                              .map(
                                (m) =>
                                  `${m.employeeIdNo}${m.supplierName ? ` · ${m.supplierName}` : ""}`
                              )
                              .join("  |  ")}
                          </span>
                        ) : (
                          <span className="block truncate text-xs text-subtle">
                            {matchTrade(row.designation) ?? (
                              <span className="text-[var(--warning)]">
                                {row.designation
                                  ? `"${row.designation}" — not one of our trades, will be blank`
                                  : "No trade on the certificate"}
                              </span>
                            )}
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
                        Add
                      </button>
                    </li>
                  ))}
                </ul>

                <p className="mt-2 text-xs text-subtle">
                  Names are checked against the roster by name, which is all the
                  certificate gives. Anyone already held is left unticked — but names
                  repeat in this workforce, so tick one anyway if it really is
                  somebody else.
                </p>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adding} onOpenChange={(v) => !v && setAdding(null)}>
        <DialogContent
          title={`Register ${adding?.name ?? "employee"}`}
          description={`Added against ${supplierName}, pre-filled from the certificate where it could be read.`}
          className="max-w-5xl"
        >
          {adding && (
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <EmployeeWizard
                {...wizardData}
                prefill={{
                  name: adding.name ?? "",
                  supplierId,
                  position: matchTrade(adding.designation) ?? "",
                }}
                onRegistered={() => {
                  setRows((prev) => prev!.filter((r) => r !== adding));
                  setAdding(null);
                  refreshPanel();
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
