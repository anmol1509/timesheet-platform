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
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="clientId" value={client.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
