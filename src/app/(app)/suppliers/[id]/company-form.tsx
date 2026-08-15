"use client";

import { useState, useTransition } from "react";
import { FormSaveBar, useUnsavedGuard } from "@/components/FormSaveBar";
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
  const guard = useUnsavedGuard();

  return (
    <form
      onInput={guard.onInput}
      action={(formData) => {
        setSaved(false);
        guard.markSaved();
        startTransition(async () => {
          await updateSupplierCompanyAction(formData);
          setSaved(true);
        });
      }}
      className="card space-y-4 p-6"
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
            className="input w-full"
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
            className="input w-full"
          />
        </Field>
        <Field label="TRN (Tax Registration Number)">
          <input
            name="trn"
            defaultValue={supplier.trn || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Active from">
          <input
            name="activeFrom"
            type="date"
            defaultValue={supplier.activeFrom}
            className="input w-full"
          />
        </Field>
        <Field label="MOHRE manpower supply permit #">
          <input
            name="mohrePermitNumber"
            defaultValue={supplier.mohrePermitNumber || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Trade license number">
          <input
            name="tradeLicenseNumber"
            defaultValue={supplier.tradeLicenseNumber || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Trade license expiry">
          <input
            name="tradeLicenseExpiry"
            type="date"
            defaultValue={supplier.tradeLicenseExpiry}
            className="input w-full"
          />
        </Field>
        <Field label="Previous ID">
          <input
            name="previousId"
            defaultValue={supplier.previousId || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Country">
          <CountrySelect name="country" defaultValue={supplier.country || ""} />
        </Field>
        <Field label="Emirate">
          <input
            name="emirate"
            defaultValue={supplier.emirate || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Point of contact">
          <input
            name="pointOfContact"
            defaultValue={supplier.pointOfContact || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Supplier amount limit (credit limit)">
          <input
            name="supplierAmountLimit"
            type="number"
            step="0.01"
            defaultValue={supplier.supplierAmountLimit ?? ""}
            className="input w-full"
          />
        </Field>
        <Field label="Account (reference only)">
          <input
            name="account"
            defaultValue={supplier.account || ""}
            className="input w-full"
          />
        </Field>
        <CheckboxField
          label="Allow manual labour ID"
          name="allowManualLabourId"
          defaultChecked={supplier.allowManualLabourId}
        />
        <CheckboxField label="Overtime applies" name="overtime" defaultChecked={supplier.overtime} />
      </div>

      <FormSaveBar pending={pending} saved={saved} dirty={guard.dirty} />
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
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
