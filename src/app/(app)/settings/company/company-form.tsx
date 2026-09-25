"use client";

import { useActionState, useState } from "react";
import { CitySelect } from "@/components/ui/CitySelect";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { PhoneField } from "@/components/ui/PhoneField";
import { updateCompanyAction } from "./actions";

type Branch = {
  id: string;
  name: string;
  emirate: string | null;
  address: string | null;
  country: string | null;
  currency: string | null;
  phone: string | null;
  email: string | null;
  fax: string | null;
  poBox: string | null;
  trn: string | null;
};

export function CompanyForm({ branch }: { branch: Branch }) {
  const [state, action, pending] = useActionState(updateCompanyAction, { error: null } as { error: string | null; ok?: boolean });
  const [country, setCountry] = useState(branch.country ?? "United Arab Emirates");
  const lab = "mb-1 block text-xs font-medium text-muted";
  const f = (label: string, name: keyof Branch, opts: { required?: boolean; span?: boolean } = {}) => (
    <label className={opts.span ? "block sm:col-span-2" : "block"}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input name={name} defaultValue={branch[name] ?? ""} required={opts.required} className="input w-full" />
    </label>
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="branchId" value={branch.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        {f("Company name", "name", { required: true, span: true })}
        {f("Address", "address", { span: true })}
        <div><span className={lab}>Country</span><CountrySelect name="country" value={country} onChange={setCountry} /></div>
        <div><span className={lab}>Emirate / city</span><CitySelect name="emirate" country={country} defaultValue={branch.emirate ?? ""} /></div>
        <div><span className={lab}>Phone</span><PhoneField name="phone" defaultValue={branch.phone} /></div>
        <div><span className={lab}>Fax</span><PhoneField name="fax" defaultValue={branch.fax} /></div>
        {f("Email", "email")}
        {f("P.O. Box", "poBox")}
        <div><span className={lab}>Tax Registration Number (TRN)</span><MaskedInput kind="trn" name="trn" defaultValue={branch.trn ?? ""} /></div>
        <div><span className={lab}>Currency</span><CurrencySelect name="currency" defaultValue={branch.currency ?? "AED"} /></div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save company details"}
        </button>
        {state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}
        {state.ok && <p role="status" className="text-sm text-[var(--success-text,#067647)]">Saved.</p>}
      </div>
    </form>
  );
}
