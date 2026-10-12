"use client";

import { CitySelect } from "@/components/ui/CitySelect";
import { PhoneField } from "@/components/ui/PhoneField";
import { useState, useTransition } from "react";
import { updateSupplierContactPaymentAction } from "../actions";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { UAE_BANKS } from "@/lib/formLists";
import { PAYMENT_TERMS } from "@/lib/formLists";
import { NumberInput } from "@/components/ui/NumberInput";
import { MaskedInput } from "@/components/ui/MaskedInput";

type Supplier = {
  id: string;
  country: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  phone: string | null;
  location: string | null;
  poBox: string | null;
  coordinatorName: string | null;
  coordinatorPhone: string | null;
  coordinatorEmail: string | null;
  bankName: string | null;
  iban: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankCompany: string | null;
  bankEmirate: string | null;
  paymentTerms: string | null;
  payoutCycleStartDay: number;
};

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function payoutPeriodLabel(startDay: number) {
  if (startDay <= 1) return "1st – last day of month (calendar month)";
  const endDay = startDay - 1;
  return `${ordinal(startDay)} – ${ordinal(endDay)} of next month`;
}

export function SupplierContactPaymentForm({ supplier }: { supplier: Supplier }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [cycleStartDay, setCycleStartDay] = useState(supplier.payoutCycleStartDay);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateSupplierContactPaymentAction(formData);
          setSaved(true);
        });
      }}
      className="card space-y-6 p-6"
    >
      <input type="hidden" name="supplierId" value={supplier.id} />

      <Section title="Contact">
        <Field label="Contact person">
          <input
            name="contactPerson"
            defaultValue={supplier.contactPerson || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Contact phone">
          <PhoneField name="contactPhone" defaultValue={supplier.contactPhone} country={supplier.country} />
        </Field>
        <Field label="Contact email">
          <input
            name="contactEmail"
            type="email"
            defaultValue={supplier.contactEmail || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Phone">
          <PhoneField name="phone" defaultValue={supplier.phone} country={supplier.country} />
        </Field>
        <Field label="Location / address">
          <input
            name="location"
            defaultValue={supplier.location || ""}
            className="input w-full"
          />
        </Field>
        <Field label="P.O. Box">
          <input
            name="poBox"
            defaultValue={supplier.poBox || ""}
            className="input w-full"
          />
        </Field>
      </Section>

      <Section title="Camp Coordinator">
        <Field label="Coordinator name">
          <input
            name="coordinatorName"
            placeholder="Point of contact for this supplier's workers' camp check-ins"
            defaultValue={supplier.coordinatorName || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Coordinator phone">
          <PhoneField name="coordinatorPhone" defaultValue={supplier.coordinatorPhone} country={supplier.country} />
        </Field>
        <Field label="Coordinator email">
          <input
            name="coordinatorEmail"
            type="email"
            defaultValue={supplier.coordinatorEmail || ""}
            className="input w-full"
          />
        </Field>
      </Section>

      <Section title="Payment">
        <Field label="Bank name">
          <ComboSelect name="bankName" options={UAE_BANKS} defaultValue={supplier.bankName} />
        </Field>
        <Field label="IBAN">
          <MaskedInput kind="iban"
            name="iban"
            defaultValue={supplier.iban || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Bank account name">
          <input
            name="bankAccountName"
            defaultValue={supplier.bankAccountName || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Bank account number">
          <input
            name="bankAccountNumber"
            defaultValue={supplier.bankAccountNumber || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Bank beneficiary company">
          <input
            name="bankCompany"
            defaultValue={supplier.bankCompany || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Bank emirate">
          <CitySelect name="bankEmirate" country={null} defaultValue={supplier.bankEmirate ?? ""} />
        </Field>
        <Field label="Payment terms">
          <ComboSelect name="paymentTerms" options={PAYMENT_TERMS} defaultValue={supplier.paymentTerms} />
        </Field>
        <Field label="Payout cycle start day">
          <NumberInput name="payoutCycleStartDay" value={cycleStartDay} onChange={(v) => setCycleStartDay(Number(String(v)) || 1)} min={1} max={31} className="w-full" />
          <p className="mt-1 text-xs text-muted">
            Payout period: {payoutPeriodLabel(cycleStartDay)}
          </p>
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
        {saved && !pending && <span className="text-sm text-[var(--success)]">Saved.</span>}
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

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}
        {required && <span className="text-[var(--error)]"> *</span>}</span>
      {children}
    </label>
  );
}
