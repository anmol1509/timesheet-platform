"use client";

import { useState, useTransition } from "react";
import { updateClientAction } from "../actions";

type Client = {
  id: string;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  basicRate: number | null;
  hourlyRate: number | null;
  contractStart: string;
  contractEnd: string;
  status: string;
  trn: string | null;
  tradeLicenseNumber: string | null;
  tradeLicenseExpiry: string;
  billingAddress: string | null;
  paymentTerms: string | null;
  retentionPercent: number | null;
  secondContactName: string | null;
  secondContactPhone: string | null;
  secondContactEmail: string | null;
};

export function EditClientForm({ client }: { client: Client }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateClientAction(formData);
          setSaved(true);
        });
      }}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="clientId" value={client.id} />

      <Section title="Contact">
        <Field label="Contact person">
          <input
            name="contactPerson"
            defaultValue={client.contactPerson || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Contact email">
          <input
            name="contactEmail"
            type="email"
            defaultValue={client.contactEmail || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Contact phone">
          <input
            name="contactPhone"
            defaultValue={client.contactPhone || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Accounts payable contact">
          <input
            name="secondContactName"
            placeholder="If different from above"
            defaultValue={client.secondContactName || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="AP contact phone">
          <input
            name="secondContactPhone"
            defaultValue={client.secondContactPhone || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="AP contact email">
          <input
            name="secondContactEmail"
            type="email"
            defaultValue={client.secondContactEmail || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
      </Section>

      <Section title="Billing & compliance">
        <Field label="TRN (Tax Registration Number)">
          <input
            name="trn"
            defaultValue={client.trn || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Trade license number">
          <input
            name="tradeLicenseNumber"
            defaultValue={client.tradeLicenseNumber || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Trade license expiry">
          <input
            name="tradeLicenseExpiry"
            type="date"
            defaultValue={client.tradeLicenseExpiry}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Payment terms">
          <input
            name="paymentTerms"
            placeholder="e.g. Net 30"
            defaultValue={client.paymentTerms || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Retention (%)">
          <input
            name="retentionPercent"
            type="number"
            step="0.1"
            defaultValue={client.retentionPercent ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Billing address" className="sm:col-span-2">
          <input
            name="billingAddress"
            defaultValue={client.billingAddress || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
      </Section>

      <Section title="Contract">
        <Field label="Status">
          <select
            name="status"
            defaultValue={client.status}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </Field>
        <Field label="Basic rate (AED)">
          <input
            name="basicRate"
            type="number"
            step="0.01"
            defaultValue={client.basicRate ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Hourly rate (AED)">
          <input
            name="hourlyRate"
            type="number"
            step="0.01"
            defaultValue={client.hourlyRate ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Contract start">
          <input
            name="contractStart"
            type="date"
            defaultValue={client.contractStart}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Contract end">
          <input
            name="contractEnd"
            type="date"
            defaultValue={client.contractEnd}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && !pending && (
          <span className="text-sm text-emerald-600">Saved.</span>
        )}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

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
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
