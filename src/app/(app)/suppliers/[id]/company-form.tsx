"use client";

import { useState, useTransition } from "react";
import { updateSupplierCompanyAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { CountrySelect } from "@/components/ui/CountrySelect";

type Supplier = {
  id: string;
  parentSupplierId: string | null;
  fullName: string | null;
  status: string;
  trn: string | null;
  activeFrom: string;
  mohrePermitNumber: string | null;
  tradeLicenseNumber: string | null;
  tradeLicenseExpiry: string;
  category: string | null;
  previousId: string | null;
  country: string | null;
  emirate: string | null;
  pointOfContact: string | null;
  supplierAmountLimit: number | null;
  account: string | null;
  allowManualLabourId: boolean;
  overtime: boolean;
};

export function SupplierCompanyForm({
  supplier,
  parentOptions,
}: {
  supplier: Supplier;
  parentOptions: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateSupplierCompanyAction(formData);
          setSaved(true);
        });
      }}
      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="supplierId" value={supplier.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <Field label="Category">
          <input
            name="category"
            placeholder="e.g. Manpower Supply"
            defaultValue={supplier.category || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
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
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && !pending && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
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
