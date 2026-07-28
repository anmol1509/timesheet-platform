"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createClientAction } from "../actions";

export default function NewClientPage() {
  const [state, formAction, pending] = useActionState(createClientAction, {
    error: null,
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/clients" className="text-sm text-slate-500 hover:underline">
          ← Clients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Add Client
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Register a client company and its rate card.
        </p>
      </div>

      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
      >
        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <Field label="Company name">
          <input
            name="name"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contact person">
            <input
              name="contactPerson"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Contact email">
            <input
              name="contactEmail"
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Contact phone">
            <input
              name="contactPhone"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Status">
            <select
              name="status"
              defaultValue="ACTIVE"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Hourly rate (AED)">
            <input
              name="hourlyRate"
              type="number"
              step="0.01"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Contract start">
            <input
              name="contractStart"
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Contract end">
            <input
              name="contractEnd"
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add Client"}
        </button>
      </form>
    </div>
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
