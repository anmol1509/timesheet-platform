"use client";

import { useState, useTransition } from "react";
import { addLpoAction, updateLpoAction, closeLpoAction } from "../actions";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { TRADES } from "@/lib/formLists";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";

type Lpo = {
  id: string;
  lpoNumber: string;
  value: number | null;
  quantity: number | null;
  trade: string | null;
  rate: number | null;
  validFrom: string;
  validTo: string;
  status: string;
  billedAmount: number;
  notes: string | null;
};

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function ProjectLpo({
  projectId,
  clientId,
  lpos,
}: {
  projectId: string;
  clientId: string;
  lpos: Lpo[];
}) {
  const [pending, startTransition] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function submitNew(formData: FormData) {
    formData.set("projectId", projectId);
    formData.set("clientId", clientId);
    startTransition(async () => {
      await addLpoAction(formData);
      setShowNew(false);
    });
  }

  function submitEdit(formData: FormData, lpoId: string) {
    formData.set("projectId", projectId);
    formData.set("lpoId", lpoId);
    startTransition(async () => {
      await updateLpoAction(formData);
      setEditingId(null);
    });
  }

  function close(lpoId: string) {
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("lpoId", lpoId);
    startTransition(async () => {
      await closeLpoAction(formData);
    });
  }

  return (
    <div className="space-y-4">
      {lpos.length === 0 && !showNew && (
        <p className="text-sm text-muted">No LPOs recorded for this project yet.</p>
      )}

      <div className="space-y-3">
        {lpos.map((lpo) => {
          const remaining = lpo.value != null ? lpo.value - lpo.billedAmount : null;
          const lowBalance = remaining != null && lpo.value ? remaining / lpo.value < 0.1 : false;
          const expiringSoon =
            lpo.validTo &&
            (new Date(lpo.validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 30;

          return editingId === lpo.id ? (
            <form
              key={lpo.id}
              action={(fd) => submitEdit(fd, lpo.id)}
              className="space-y-3 rounded-2xl border border-default bg-surface p-4"
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Value (AED)">
                  <NumberInput name="value" defaultValue={lpo.value ?? ""} step={0.01} />
                </Field>
                <Field label="Quantity">
                  <NumberInput name="quantity" defaultValue={lpo.quantity ?? ""} />
                </Field>
                <Field label="Trade">
                  <ComboSelect name="trade" options={TRADES} defaultValue={lpo.trade} />
                </Field>
                <Field label="Rate (AED/hr)">
                  <NumberInput name="rate" defaultValue={lpo.rate ?? ""} step={0.01} />
                </Field>
                <Field label="Valid from">
                  <DatePicker name="validFrom" defaultValue={lpo.validFrom} />
                </Field>
                <Field label="Valid to (expiry)">
                  <DatePicker name="validTo" defaultValue={lpo.validTo} />
                </Field>
                <Field label="Billed amount (AED)">
                  <NumberInput name="billedAmount" defaultValue={lpo.billedAmount} step={0.01} />
                </Field>
                <Field label="Notes" className="col-span-2 sm:col-span-3">
                  <input name="notes" defaultValue={lpo.notes ?? ""} className={inputCls} />
                </Field>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="btn btn-primary btn-sm"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-xs font-medium text-subtle hover:underline"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div key={lpo.id} className="rounded-2xl border border-default bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-primary">{lpo.lpoNumber}</span>
                  <StatusBadge status={lpo.status} />
                  {lpo.status === "ACTIVE" && expiringSoon && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Expiring soon
                    </span>
                  )}
                  {lpo.status === "ACTIVE" && lowBalance && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Low balance
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(lpo.id)}
                    className="text-xs font-medium text-muted hover:underline"
                  >
                    Edit
                  </button>
                  {lpo.status === "ACTIVE" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => close(lpo.id)}
                      className="text-xs font-medium text-muted hover:underline disabled:opacity-50"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                <Detail label="Value" value={lpo.value != null ? `AED ${fmtMoney(lpo.value)}` : "—"} />
                <Detail label="Billed" value={`AED ${fmtMoney(lpo.billedAmount)}`} />
                <Detail
                  label="Remaining"
                  value={remaining != null ? `AED ${fmtMoney(remaining)}` : "—"}
                />
                <Detail label="Quantity" value={lpo.quantity != null ? String(lpo.quantity) : "—"} />
                <Detail label="Trade" value={lpo.trade || "—"} />
                <Detail label="Rate" value={lpo.rate != null ? `AED ${fmtMoney(lpo.rate)}/hr` : "—"} />
                <Detail label="Valid from" value={lpo.validFrom || "—"} />
                <Detail label="Expiry" value={lpo.validTo || "—"} />
              </dl>
              {lpo.notes && <p className="mt-2 text-xs text-muted">{lpo.notes}</p>}
            </div>
          );
        })}
      </div>

      {showNew ? (
        <form
          action={submitNew}
          className="space-y-3 rounded-2xl border border-dashed border-strong bg-surface p-4"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Value (AED)">
              <NumberInput name="value" step={0.01} />
            </Field>
            <Field label="Quantity">
              <NumberInput name="quantity" />
            </Field>
            <Field label="Trade">
              <ComboSelect name="trade" options={TRADES} />
            </Field>
            <Field label="Rate (AED/hr)">
              <NumberInput name="rate" step={0.01} />
            </Field>
            <Field label="Valid from">
              <DatePicker name="validFrom" />
            </Field>
            <Field label="Valid to (expiry)">
              <DatePicker name="validTo" />
            </Field>
            <Field label="Notes" className="col-span-2 sm:col-span-3">
              <input name="notes" className={inputCls} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary btn-sm"
            >
              {pending ? "Adding…" : "Add LPO"}
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="text-xs font-medium text-subtle hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="btn btn-secondary"
        >
          + Add LPO
        </button>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-strong px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className || ""}`}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="text-primary">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    EXPIRED: "bg-surface-sunken text-secondary",
    CLOSED: "bg-surface-sunken text-secondary",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-surface-sunken text-secondary"}`}>
      {status}
    </span>
  );
}
