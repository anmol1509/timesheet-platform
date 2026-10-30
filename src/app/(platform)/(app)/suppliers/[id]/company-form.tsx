"use client";

import { SaveWarnings } from "@/components/SaveWarnings";
import { CitySelect } from "@/components/ui/CitySelect";
import { useState, useTransition, useRef } from "react";
import { FormSaveBar, useUnsavedGuard } from "@/components/FormSaveBar";
import { updateSupplierCompanyAction } from "../actions";
import { SupplierCodeField } from "../supplier-code-field";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { SUPPLIER_CATEGORIES } from "@/lib/formLists";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { Alert } from "@/components/Alert";

type Supplier = {
  id: string;
  name: string;
  code: string | null;
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
  supplierAmountLimit: number | null;
  account: string | null;
  isOwnCompany: boolean;
  payType: string | null;
  wpsEstablishmentId: string | null;
  allowManualLabourId: boolean;
  overtime: boolean;
  absentFreeDays: number;
  absentDeductionPerDay: number;
  gasPerDay: number;
  gasMonthlyCap: number;
  shortfallMode: string;
  shortfallHalfDayUnder: number;
};

export function SupplierCompanyForm({
  supplier,
  parentIsOwnCompany = false,
}: {
  supplier: Supplier;
  /** The primary supplier above this one is one of our own companies. */
  parentIsOwnCompany?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState(supplier.country || "United Arab Emirates");
  const guard = useUnsavedGuard();
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const lastForm = useRef<FormData | null>(null);
  const [ownChoice, setOwnChoice] = useState(supplier.isOwnCompany);
  const own = parentIsOwnCompany || ownChoice;

  return (
    <form
      onInput={guard.onInput}
      // A submit handler rather than a form action: React resets a form after
      // its action finishes, which flipped the switches back to how they were
      // when the page loaded.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        lastForm.current = formData;
        setSaved(false);
        setWarnings(null);
        guard.markSaved();
        startTransition(async () => {
          const res = await updateSupplierCompanyAction(formData);
          setError(res.error);
          setWarnings(res.warnings?.length ? res.warnings : null);
          setSaved(!res.error && !res.warnings?.length);
        });
      }}
      className="card space-y-4 p-6"
    >
      <input type="hidden" name="supplierId" value={supplier.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Supplier name">
          <input name="name" required maxLength={200} defaultValue={supplier.name} className="input w-full" />
        </Field>
        <FieldBlock label="Supplier code">
          <SupplierCodeField defaultValue={supplier.code || ""} fixedName={supplier.name} supplierId={supplier.id} />
        </FieldBlock>
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
          <ComboSelect name="category" options={SUPPLIER_CATEGORIES} defaultValue={supplier.category} />
        </Field>
        <Field label="TRN (Tax Registration Number)">
          <MaskedInput kind="trn"
            name="trn"
            defaultValue={supplier.trn || ""}
            className="input w-full"
          />
        </Field>
        <FieldBlock label="Active from">
          <DatePicker
            name="activeFrom"
            defaultValue={supplier.activeFrom}
            ariaLabel="Active from"
          />
        </FieldBlock>
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
        <FieldBlock label="Trade license expiry">
          <DatePicker
            name="tradeLicenseExpiry"
            defaultValue={supplier.tradeLicenseExpiry}
            ariaLabel="Trade license expiry"
          />
        </FieldBlock>
        <Field label="Previous ID">
          <input
            name="previousId"
            defaultValue={supplier.previousId || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Country">
          <CountrySelect name="country" value={country} onChange={setCountry} />
        </Field>
        <Field label="Emirate">
          <CitySelect name="emirate" country={country} defaultValue={supplier.emirate ?? ""} />
        </Field>
        <FieldBlock label="Supplier amount limit (credit limit)">
          <NumberInput
            name="supplierAmountLimit"
            defaultValue={supplier.supplierAmountLimit ?? ""}
            min={0}
            step={0.01}
            ariaLabel="Supplier amount limit"
          />
        </FieldBlock>
        <Field label="Account (reference only)">
          <input
            name="account"
            defaultValue={supplier.account || ""}
            className="input w-full"
          />
        </Field>
        <SwitchField
          label="Our own company"
          name="isOwnCompany"
          checked={own}
          disabled={parentIsOwnCompany}
          onCheckedChange={(v) => { setOwnChoice(v); guard.onInput(); }}
          description={parentIsOwnCompany ? "Set by the primary supplier: it is one of our own companies, so its subsidiaries are too." : "Issues documents on our letterhead, and bills this entity rather than paying it. Its subsidiaries follow this setting."}
        />
        {own && (
          <>
            <Field label="How this company pays its people">
              <Select name="payType" defaultValue={supplier.payType ?? ""} searchable={false} options={[{ value: "", label: "— not set —" }, { value: "BASIC", label: "Basic: monthly salary, from attendance" }, { value: "HOURLY", label: "Hourly: hours from the timesheet" }]} triggerClassName="w-full" />
            </Field>
            <Field label="MOHRE establishment ID (for the WPS file)">
              <input name="wpsEstablishmentId" defaultValue={supplier.wpsEstablishmentId || ""} inputMode="numeric" className="input w-full" />
            </Field>
          </>
        )}
          <input type="hidden" name="ruleSent" value="1" />
          <Field label="Payroll: days off with no deduction (each month)">
            <NumberInput name="absentFreeDays" defaultValue={supplier.absentFreeDays} min={0} max={31} step={1} className="w-full" />
          </Field>
          <Field label="Payroll: deduction per day off after that (AED)">
            <NumberInput name="absentDeductionPerDay" defaultValue={supplier.absentDeductionPerDay} min={0} step={0.5} className="w-full" />
          </Field>
          <Field label="Timesheet gas charge per day from check-in (AED)">
            <NumberInput name="gasPerDay" defaultValue={supplier.gasPerDay} min={0} step={0.5} className="w-full" />
          </Field>
          <Field label="Timesheet gas charge limit per month (AED)">
            <NumberInput name="gasMonthlyCap" defaultValue={supplier.gasMonthlyCap} min={0} step={1} className="w-full" />
          </Field>
          <Field label="Short hours on a present day">
            <Select
              name="shortfallMode" defaultValue={supplier.shortfallMode || "OFF"} searchable={false}
              options={[{ value: "OFF", label: "Off: no deduction for short days" }, { value: "HOURLY", label: "Hourly: the missing hours at the hourly rate" }, { value: "HALF_DAY", label: "Half day: half a day's pay when under a set number of hours" }]}
              triggerClassName="w-full"
            />
          </Field>
          <Field label="Half day when under this many hours (Half day rule only)">
            <NumberInput name="shortfallHalfDayUnder" defaultValue={supplier.shortfallHalfDayUnder} min={0} max={24} step={0.5} className="w-full" />
          </Field>
        <SwitchField
          label="Allow manual labour ID"
          name="allowManualLabourId"
          defaultChecked={supplier.allowManualLabourId}
          onChange={guard.onInput}
        />
        <SwitchField label="Overtime applies" name="overtime" defaultChecked={supplier.overtime} onChange={guard.onInput} />
      </div>

      {warnings && !pending && (
        <SaveWarnings
          warnings={warnings}
          onDismiss={() => setWarnings(null)}
          onSaveAnyway={() => {
            const fd = lastForm.current;
            if (!fd) return;
            const again = new FormData();
            for (const [k, v] of fd.entries()) again.append(k, v);
            again.set("confirmWarnings", "1");
            setWarnings(null);
            startTransition(async () => {
              const res = await updateSupplierCompanyAction(again);
              setError(res.error);
              setSaved(!res.error);
            });
          }}
        />
      )}
      {error && (
        <Alert>
          {error}
        </Alert>
      )}
      <FormSaveBar pending={pending} saved={saved} dirty={guard.dirty} />
    </form>
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

/**
 * Field for a control that contains its own button (DatePicker) or several
 * inputs (NumberInput) — those can't sit inside a <label>, whose click would
 * be forwarded to the first labelable descendant. The control carries its own
 * accessible name via ariaLabel instead.
 */
function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </div>
  );
}

/**
 * A supplier setting that reads as a switch rather than a checkbox. It is part
 * of the form and only saved with it, so flipping it raises the Save bar. Unchecked switches submit nothing, which is what
 * the `=== "on"` parse in the save action expects.
 */
function SwitchField({
  label,
  name,
  defaultChecked,
  checked,
  disabled,
  description,
  onChange,
  onCheckedChange,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  checked?: boolean;
  disabled?: boolean;
  description?: string;
  /** A switch is a button, so it doesn't fire the form's input event by itself. */
  onChange?: () => void;
  onCheckedChange?: (v: boolean) => void;
}) {
  return (
    <div className="pt-5">
      <Switch
        name={name}
        value="on"
        defaultChecked={defaultChecked}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => { onCheckedChange?.(v); onChange?.(); }}
        label={label}
        description={description}
      />
    </div>
  );
}
