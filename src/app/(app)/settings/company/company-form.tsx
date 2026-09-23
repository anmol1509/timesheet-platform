"use client";

import { useActionState } from "react";
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
        {f("Emirate / city", "emirate")}
        {f("Country", "country")}
        {f("Phone", "phone")}
        {f("Fax", "fax")}
        {f("Email", "email")}
        {f("P.O. Box", "poBox")}
        {f("Tax Registration Number (TRN)", "trn")}
        {f("Currency", "currency")}
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
