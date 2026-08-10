"use client";

import { useState, useTransition } from "react";
import { updateSupplierAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { CountrySelect } from "@/components/ui/CountrySelect";

type Supplier = {
  id: string;
  parentSupplierId: string | null;
  fullName: string | null;
  mohrePermitNumber: string | null;
  tradeLicenseNumber: string | null;
  tradeLicenseExpiry: string;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  bankName: string | null;
  iban: string | null;
  paymentTerms: string | null;
  status: string;
  payoutCycleStartDay: number;
  category: string | null;
  previousId: string | null;
  allowManualLabourId: boolean;
  overtime: boolean;
  supplierAmountLimit: number | null;
  pointOfContact: string | null;
  country: string | null;
  emirate: string | null;
  account: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankCompany: string | null;
  bankEmirate: string | null;
  trn: string | null;
  activeFrom: string;
  poBox: string | null;
  location: string | null;
  phone: string | null;
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

export function EditSupplierForm({
  supplier,
  parentOptions,
}: {
  supplier: Supplier;
  parentOptions: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [cycleStartDay, setCycleStartDay] = useState(supplier.payoutCycleStartDay);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateSupplierAction(formData);
          setSaved(true);
        });
      }}
      className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="supplierId" value={supplier.id} />

      <Section title="Company">
        <Field label="Parent Supplier">
          <Select
            name="parentSupplierId"
            defaultValue={supplier.parentSupplierId || ""}
            placeholder="None — top-level supplier"
            options={parentOptions.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Field>
        <Field label="Full name (for letterhead)">
          <input
            name="fullName"
            defaultValue={supplier.fullName || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Status">
          <Select
            name="status"
            defaultValue={supplier.status}
            searchable={false}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "BLACKLISTED", label: "Blacklisted" },
            ]}
          />
        </Field>
        <Field label="TRN (Tax Registration Number)">
          <input
            name="trn"
            defaultValue={supplier.trn || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Active from">
          <input
            name="activeFrom"
            type="date"
            defaultValue={supplier.activeFrom}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="MOHRE manpower supply permit #">
          <input
            name="mohrePermitNumber"
            defaultValue={supplier.mohrePermitNumber || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Trade license number">
          <input
            name="tradeLicenseNumber"
            defaultValue={supplier.tradeLicenseNumber || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Trade license expiry">
          <input
            name="tradeLicenseExpiry"
            type="date"
            defaultValue={supplier.tradeLicenseExpiry}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Category">
          <input
            name="category"
            placeholder="e.g. Manpower Supply"
            defaultValue={supplier.category || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Previous ID">
          <input
            name="previousId"
            defaultValue={supplier.previousId || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Country">
          <CountrySelect name="country" defaultValue={supplier.country || ""} />
        </Field>
        <Field label="Emirate">
          <input
            name="emirate"
            defaultValue={supplier.emirate || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Point of contact">
          <input
            name="pointOfContact"
            defaultValue={supplier.pointOfContact || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Supplier amount limit (credit limit)">
          <input
            name="supplierAmountLimit"
            type="number"
            step="0.01"
            defaultValue={supplier.supplierAmountLimit ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Account (reference only)">
          <input
            name="account"
            defaultValue={supplier.account || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <CheckboxField
          label="Allow manual labour ID"
          name="allowManualLabourId"
          defaultChecked={supplier.allowManualLabourId}
        />
        <CheckboxField label="Overtime applies" name="overtime" defaultChecked={supplier.overtime} />
      </Section>

      <Section title="Contact">
        <Field label="Contact person">
          <input
            name="contactPerson"
            defaultValue={supplier.contactPerson || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Contact phone">
          <input
            name="contactPhone"
            defaultValue={supplier.contactPhone || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Contact email">
          <input
            name="contactEmail"
            type="email"
            defaultValue={supplier.contactEmail || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Phone">
          <input
            name="phone"
            placeholder="Landline, if different from mobile"
            defaultValue={supplier.phone || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Location / address">
          <input
            name="location"
            defaultValue={supplier.location || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="P.O. Box">
          <input
            name="poBox"
            defaultValue={supplier.poBox || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
      </Section>

      <Section title="Payment">
        <Field label="Bank name">
          <input
            name="bankName"
            defaultValue={supplier.bankName || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="IBAN">
          <input
            name="iban"
            defaultValue={supplier.iban || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Bank account name">
          <input
            name="bankAccountName"
            defaultValue={supplier.bankAccountName || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Bank account number">
          <input
            name="bankAccountNumber"
            defaultValue={supplier.bankAccountNumber || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Bank beneficiary company">
          <input
            name="bankCompany"
            defaultValue={supplier.bankCompany || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Bank emirate">
          <input
            name="bankEmirate"
            defaultValue={supplier.bankEmirate || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Payment terms">
          <input
            name="paymentTerms"
            placeholder="e.g. Net 30"
            defaultValue={supplier.paymentTerms || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Payout cycle start day">
          <input
            name="payoutCycleStartDay"
            type="number"
            min={1}
            max={31}
            value={cycleStartDay}
            onChange={(e) => setCycleStartDay(Number(e.target.value) || 1)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
          <p className="mt-1 text-xs text-slate-500">
            Payout period: {payoutPeriodLabel(cycleStartDay)}
          </p>
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
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

function CheckboxField({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="pt-5">
      <Checkbox name={name} value="on" defaultChecked={defaultChecked} label={label} />
    </div>
  );
}
