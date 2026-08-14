"use client";

import { useState, useTransition } from "react";
import { updateClientAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { CountrySelect } from "@/components/ui/CountrySelect";

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
  country: string | null;
  emirate: string | null;
  website: string | null;
  fax: string | null;
  poBox: string | null;
  paymentSchedule: string | null;
  account: string | null;
  vendorCode: string | null;
  customer: string | null;
  currency: string | null;
  grades: string | null;
  telephone: string | null;
};

export function EditClientForm({ client }: { client: Client }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [billingType, setBillingType] = useState(
    client.hourlyRate != null ? "HOURLY" : client.basicRate != null ? "BASIC" : ""
  );

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateClientAction(formData);
          setSaved(true);
        });
      }}
      className="card space-y-6 p-6"
    >
      <input type="hidden" name="clientId" value={client.id} />

      <Section title="Company">
        <Field label="Country">
          <CountrySelect name="country" defaultValue={client.country || ""} />
        </Field>
        <Field label="Emirate">
          <input
            name="emirate"
            defaultValue={client.emirate || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Customer">
          <input
            name="customer"
            placeholder="Parent/umbrella account, if applicable"
            defaultValue={client.customer || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Currency">
          <input
            name="currency"
            defaultValue={client.currency || "AED"}
            className="input w-full"
          />
        </Field>
        <Field label="Grade">
          <input
            name="grades"
            defaultValue={client.grades || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Website">
          <input
            name="website"
            defaultValue={client.website || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Payment schedule">
          <input
            name="paymentSchedule"
            defaultValue={client.paymentSchedule || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Fax">
          <input
            name="fax"
            defaultValue={client.fax || ""}
            className="input w-full"
          />
        </Field>
        <Field label="P.O. Box">
          <input
            name="poBox"
            defaultValue={client.poBox || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Account (reference only)">
          <input
            name="account"
            defaultValue={client.account || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Vendor code">
          <input
            name="vendorCode"
            defaultValue={client.vendorCode || ""}
            className="input w-full"
          />
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="Contact person">
          <input
            name="contactPerson"
            defaultValue={client.contactPerson || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Contact email">
          <input
            name="contactEmail"
            type="email"
            defaultValue={client.contactEmail || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Contact phone (mobile)">
          <input
            name="contactPhone"
            defaultValue={client.contactPhone || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Telephone (landline)">
          <input
            name="telephone"
            defaultValue={client.telephone || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Accounts payable contact">
          <input
            name="secondContactName"
            placeholder="If different from above"
            defaultValue={client.secondContactName || ""}
            className="input w-full"
          />
        </Field>
        <Field label="AP contact phone">
          <input
            name="secondContactPhone"
            defaultValue={client.secondContactPhone || ""}
            className="input w-full"
          />
        </Field>
        <Field label="AP contact email">
          <input
            name="secondContactEmail"
            type="email"
            defaultValue={client.secondContactEmail || ""}
            className="input w-full"
          />
        </Field>
      </Section>

      <Section title="Billing & compliance">
        <Field label="TRN (Tax Registration Number)">
          <input
            name="trn"
            defaultValue={client.trn || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Trade license number">
          <input
            name="tradeLicenseNumber"
            defaultValue={client.tradeLicenseNumber || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Trade license expiry">
          <input
            name="tradeLicenseExpiry"
            type="date"
            defaultValue={client.tradeLicenseExpiry}
            className="input w-full"
          />
        </Field>
        <Field label="Payment terms">
          <input
            name="paymentTerms"
            placeholder="e.g. Net 30"
            defaultValue={client.paymentTerms || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Retention (%)">
          <input
            name="retentionPercent"
            type="number"
            step="0.1"
            defaultValue={client.retentionPercent ?? ""}
            className="input w-full"
          />
        </Field>
        <Field label="Billing address" className="sm:col-span-2">
          <input
            name="billingAddress"
            defaultValue={client.billingAddress || ""}
            className="input w-full"
          />
        </Field>
      </Section>

      <Section title="Contract">
        <Field label="Status">
          <Select
            name="status"
            defaultValue={client.status}
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
            <input
              name="billingRate"
              type="number"
              step="0.01"
              defaultValue={
                billingType === "HOURLY" ? (client.hourlyRate ?? "") : (client.basicRate ?? "")
              }
              className="input w-full"
            />
          </Field>
        )}
        <Field label="Contract start">
          <input
            name="contractStart"
            type="date"
            defaultValue={client.contractStart}
            className="input w-full"
          />
        </Field>
        <Field label="Contract end">
          <input
            name="contractEnd"
            type="date"
            defaultValue={client.contractEnd}
            className="input w-full"
          />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
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
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-subtle uppercase">
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
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
