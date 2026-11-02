"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserX, Pencil } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/Badge";
import { ABSCOND_CASE_STATUSES } from "@/lib/absconding";
import { saveAbscondingAction } from "./absconding-actions";

export type AbscondingInfo = { id: string; name: string; status: string; abscondedAt: string | null; remarks: string | null; caseStatus: string | null; canEdit: boolean };

const CASE_COLOR: Record<string, "red" | "amber" | "slate" | "green"> = { Reported: "red", "Under investigation": "amber", Closed: "slate", Returned: "green" };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/**
 * The absconding case on a worker's profile: shown while the worker is marked as absconding (and kept as history once the
 * case is closed or the worker has returned), with a form to mark a worker or update the case.
 */
export function AbscondingCase({ info, onChanged }: { info: AbscondingInfo; onChanged?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(info.abscondedAt ?? "");
  const [caseStatus, setCaseStatus] = useState(info.caseStatus ?? "Reported");
  const [remarks, setRemarks] = useState(info.remarks ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const has = info.status === "ABSCONDING" || !!info.caseStatus;
  const active = info.status === "ABSCONDING";

  function save() {
    setError(null);
    start(async () => {
      const r = await saveAbscondingAction({ id: info.id, date, remarks, caseStatus });
      if ("error" in r) { setError(r.error); return; }
      setOpen(false);
      if (onChanged) onChanged(); else router.refresh();
    });
  }

  return (
    <>
      {has ? (
        <section className={active ? "rounded-[14px] border border-[var(--error-border)] bg-[var(--error-soft)] p-4" : "rounded-[14px] border border-default p-4"} aria-label="Absconding case">
          <div className="flex flex-wrap items-center gap-2">
            <UserX className={active ? "h-4 w-4 text-[var(--error)]" : "h-4 w-4 text-muted"} aria-hidden />
            <h3 className={active ? "text-sm font-semibold text-[var(--error)]" : "text-sm font-semibold text-primary"}>{active ? "Absconding" : "Absconding case"}</h3>
            {info.caseStatus && <Badge color={CASE_COLOR[info.caseStatus] ?? "slate"} dot>{info.caseStatus}</Badge>}
            {info.canEdit && (
              <button type="button" onClick={() => setOpen(true)} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline">
                <Pencil className="h-3 w-3" aria-hidden /> Update case
              </button>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Absconded on</dt><dd className="font-medium text-primary">{info.abscondedAt ? fmt(info.abscondedAt) : "—"}</dd>
            <dt className="text-muted">Remarks</dt><dd className="whitespace-pre-line text-secondary">{info.remarks || "—"}</dd>
          </dl>
          {active && <p className="mt-3 text-xs text-muted">Not paid, scheduled or allocated while the case is open.</p>}
        </section>
      ) : info.canEdit ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-[var(--error)]">
          <UserX className="h-3.5 w-3.5" aria-hidden /> Mark as absconding
        </button>
      ) : null}

      <Dialog open={open} onOpenChange={(o) => { if (!pending) setOpen(o); }}>
        <DialogContent tone="danger" icon={<UserX className="h-[18px] w-[18px]" />} title={has ? "Update absconding case" : "Mark as absconding"} description={`${info.name} will not be paid, scheduled or allocated while the case is open.`}>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-secondary">Absconding date <span className="text-[var(--error)]">*</span></span>
              <DatePicker value={date} onChange={setDate} className="w-full" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-secondary">Case status</span>
              <Select value={caseStatus} onChange={setCaseStatus} searchable={false} options={ABSCOND_CASE_STATUSES.map((s) => ({ value: s, label: s }))} />
              <span className="mt-1 block text-[11px] text-subtle">Closed or Returned ends the case and puts the worker back on the bench.</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-secondary">Remarks</span>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} maxLength={1000} className="input w-full" placeholder="e.g. Reported to the police, ABSCONDER report no. …" />
            </label>
            {error && <Alert>{error}</Alert>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button size="btn" type="button" variant="secondary" disabled={pending}>Cancel</Button></DialogClose>
            <Button size="btn" type="button" variant="danger" onClick={save} loading={pending}>{has ? "Save case" : "Mark as absconding"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
