"use client";

import { PhoneField } from "@/components/ui/PhoneField";
import { useActionState, useState } from "react";
import Link from "next/link";
import { createClientAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";

export default function NewClientPage() {
  const [state, formAction, pending] = useActionState(createClientAction, {
    error: null,
  });
  const [billingType, setBillingType] = useState("");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/clients" className="text-sm text-muted hover:underline">
          ← Clients
        </Link>
        <h1 className="text-xl tracking-tight text-primary mt-2 font-semibold">
          Add Client
        </h1>
        <p className="mt-1 text-sm text-muted">
          Register a client company and its rate card.
        </p>
      </div>

      <form
        action={formAction}
        className="card space-y-4 p-6"
      >
        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <Field required label="Company name">
          <input
            name="name"
            required
            className="input w-full"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contact person">
            <input
              name="contactPerson"
              className="input w-full"
            />
          </Field>
          <Field label="Contact email">
            <input
              name="contactEmail"
              type="email"
              className="input w-full"
            />
          </Field>
          <Field label="Contact phone">
            <PhoneField name="contactPhone" />
          </Field>
          <Field label="Status">
            <Select
              name="status"
              defaultValue="ACTIVE"
              searchable={false}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
          </Field>
          <Field label="Billing type">
            <Select
              name="billingType"
              value={billingType}
              onChange={setBillingType}
              placeholder="Not set"
              searchable={false}
              options={[
                { value: "BASIC", label: "Basic rate" },
                { value: "HOURLY", label: "Hourly rate" },
              ]}
            />
          </Field>
          {billingType && (
            <Field label={billingType === "HOURLY" ? "Hourly rate (AED)" : "Basic rate (AED)"}>
              <NumberInput name="billingRate" step={0.01} className="w-full" />
            </Field>
          )}
          <Field label="Contract start">
            <DatePicker name="contractStart" className="w-full" />
          </Field>
          <Field label="Contract end">
            <DatePicker name="contractEnd" className="w-full" />
          </Field>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Saving…" : "Add Client"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
        {required && <span className="text-[var(--error)]"> *</span>}
      </span>
      {children}
    </label>
  );
}
