"use client";

import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { CitySelect } from "@/components/ui/CitySelect";
import { PhoneField } from "@/components/ui/PhoneField";
import { useState, useTransition } from "react";
import { FormSaveBar, useUnsavedGuard } from "@/components/FormSaveBar";
import { updateClientAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { PAYMENT_TERMS } from "@/lib/formLists";
import { PAYMENT_SCHEDULES } from "@/lib/formLists";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";
import { MaskedInput } from "@/components/ui/MaskedInput";

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
  const [country, setCountry] = useState(client.country || "United Arab Emirates");
  const guard = useUnsavedGuard();
  const [billingType, setBillingType] = useState(
    client.hourlyRate != null ? "HOURLY" : client.basicRate != null ? "BASIC" : ""
  );

  return (
    <form
      onInput={guard.onInput}
      action={(formData) => {
        setSaved(false);
        guard.markSaved();
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
          <CountrySelect name="country" value={country} onChange={setCountry} />
        </Field>
        <Field label="Emirate / city">
          <CitySelect name="emirate" country={country} defaultValue={client.emirate || ""} />
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
          <CurrencySelect name="currency" defaultValue={client.currency || "AED"} />
        </Field>
        <Field label="Grade">
          <input
            name="grades"
            defaultValue={client.grades || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Website">
          <input type="url"
            name="website"
            defaultValue={client.website || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Payment schedule">
          <ComboSelect name="paymentSchedule" options={PAYMENT_SCHEDULES} defaultValue={client.paymentSchedule} />
        </Field>
        <Field label="Fax">
          <PhoneField name="fax" defaultValue={client.fax} />
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
          <PhoneField name="contactPhone" defaultValue={client.contactPhone} />
        </Field>
        <Field label="Telephone (landline)">
          <PhoneField name="telephone" defaultValue={client.telephone} />
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
          <PhoneField name="secondContactPhone" defaultValue={client.secondContactPhone} />
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
          <MaskedInput kind="trn"
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
          <DatePicker name="tradeLicenseExpiry" defaultValue={client.tradeLicenseExpiry} className="w-full" />
        </Field>
        <Field label="Payment terms">
          <ComboSelect name="paymentTerms" options={PAYMENT_TERMS} defaultValue={client.paymentTerms} />
        </Field>
        <Field label="Retention (%)">
          <NumberInput name="retentionPercent" defaultValue={client.retentionPercent ?? ""} step={0.1} className="w-full" />
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
            <NumberInput name="billingRate" defaultValue={
                billingType === "HOURLY" ? (client.hourlyRate ?? "") : (client.basicRate ?? "")
              } step={0.01} className="w-full" />
          </Field>
        )}
        <Field label="Contract start">
          <DatePicker name="contractStart" defaultValue={client.contractStart} className="w-full" />
        </Field>
        <Field label="Contract end">
          <DatePicker name="contractEnd" defaultValue={client.contractEnd} className="w-full" />
        </Field>
      </Section>

      <FormSaveBar pending={pending} saved={saved} dirty={guard.dirty} />
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
