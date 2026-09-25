"use client";

import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { PhoneField } from "@/components/ui/PhoneField";
import { useActionState } from "react";
import { keepInput } from "@/lib/vendor/keepInput";
import { createBankAction, updateBankAction } from "./actions";

type State = { error: string | null; ok?: boolean; id?: string };
export type BankValues = {
  id?: string; accountName: string; bankName: string; abbreviation: string; accountType: string; currency: string; companyId: string;
  accountNo: string; ibanNo: string; routingCode: string; swiftCode: string; bankBranch: string; address: string;
  contactPerson: string; contactPhone: string; contactEmail: string; remarks: string; enabled: boolean;
};
export const EMPTY_BANK: BankValues = {
  accountName: "", bankName: "", abbreviation: "", accountType: "CURRENT", currency: "AED", companyId: "", accountNo: "", ibanNo: "", routingCode: "", swiftCode: "",
  bankBranch: "", address: "", contactPerson: "", contactPhone: "", contactEmail: "", remarks: "", enabled: true,
};

const F = ({ t, hint, children }: { t: string; hint?: string; children: React.ReactNode }) => (
  <label className="block"><span className="mb-1 block text-xs font-medium text-muted">{t}</span>{children}{hint && <span className="mt-1 block text-[11px] text-subtle">{hint}</span>}</label>
);
const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="space-y-3"><legend className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</legend><div className="grid gap-3 sm:grid-cols-2">{children}</div></fieldset>
);

/** One form for adding and editing a bank account. */
export function BankForm({ initial, companies, onDone }: { initial: BankValues; companies: { id: string; name: string }[]; onDone?: () => void }) {
  const editing = !!initial.id;
  const [state, action, pending] = useActionState(
    async (p: State, fd: FormData) => { const r = editing ? await updateBankAction(p, fd) : await createBankAction(p, fd); if (r.ok) onDone?.(); return r; },
    { error: null } as State
  );
  const v = initial;
  return (
    <form onSubmit={keepInput(action)} className="space-y-5">
      {editing && <input type="hidden" name="bankId" value={initial.id} />}
      <Group title="Account">
        <F t="Account name *"><input name="accountName" required defaultValue={v.accountName} placeholder="e.g. Main operating account" className="input w-full" /></F>
        <F t="Bank name *"><input name="bankName" required defaultValue={v.bankName} placeholder="e.g. Emirates NBD" className="input w-full" /></F>
        <F t="Account type"><select name="accountType" defaultValue={v.accountType} className="input w-full"><option value="CURRENT">Current</option><option value="SAVINGS">Savings</option><option value="CREDIT">Credit / overdraft</option><option value="OTHER">Other</option></select></F>
        <F t="Currency"><CurrencySelect name="currency" defaultValue={v.currency || "AED"} /></F>
        <F t="Held by (own company)" hint="Each company's payroll pays from its own account."><select name="companyId" defaultValue={v.companyId} className="input w-full"><option value="">— none —</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></F>
        <F t="Abbreviation"><input name="abbreviation" defaultValue={v.abbreviation} className="input w-full" /></F>
      </Group>
      <Group title="Account numbers (needed to make it active)">
        <F t="Account number"><input name="accountNo" defaultValue={v.accountNo} className="input w-full" /></F>
        <F t="IBAN" hint="UAE IBANs start with AE and are 23 characters."><input name="ibanNo" defaultValue={v.ibanNo} className="input w-full" /></F>
        <F t="Routing code" hint="9 digits; used in the WPS salary file."><input name="routingCode" defaultValue={v.routingCode} className="input w-full" /></F>
        <F t="SWIFT / BIC"><input name="swiftCode" defaultValue={v.swiftCode} className="input w-full" /></F>
      </Group>
      <Group title="Bank branch & contact">
        <F t="Bank branch"><input name="bankBranch" defaultValue={v.bankBranch} className="input w-full" /></F>
        <F t="Address"><input name="address" defaultValue={v.address} className="input w-full" /></F>
        <F t="Contact person at the bank"><input name="contactPerson" defaultValue={v.contactPerson} className="input w-full" /></F>
        <F t="Contact phone"><PhoneField name="contactPhone" defaultValue={v.contactPhone} /></F>
        <F t="Contact email"><input name="contactEmail" defaultValue={v.contactEmail} className="input w-full" /></F>
        <F t="Remarks"><input name="remarks" defaultValue={v.remarks} className="input w-full" /></F>
      </Group>
      {editing && <label className="flex items-center gap-2 text-sm text-secondary"><input type="hidden" name="enabled" value="0" /><input type="checkbox" name="enabled" value="1" defaultChecked={v.enabled} className="h-4 w-4" onChange={(e) => { const h = e.currentTarget.previousElementSibling as HTMLInputElement; h.disabled = e.currentTarget.checked; }} />Account is in use (untick to switch it off)</label>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Add bank"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
        {editing && state.ok && !pending && <span className="text-sm text-[var(--success)]">Saved.</span>}
      </div>
    </form>
  );
}
