"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Select } from "@/components/ui/Select";
import { updateWpsAction } from "./actions";

export type BankOption = { id: string; label: string; complete: boolean };

export function WpsForm({
  branchId,
  establishmentId,
  payerBankId,
  banks,
}: {
  branchId: string;
  establishmentId: string;
  payerBankId: string;
  banks: BankOption[];
}) {
  const [state, action, pending] = useActionState(updateWpsAction, { error: null } as { error: string | null; ok?: boolean });
  const selected = banks.find((b) => b.id === payerBankId);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="branchId" value={branchId} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">MOHRE establishment ID (employer ID)</span>
        <input name="wpsEstablishmentId" defaultValue={establishmentId} inputMode="numeric" placeholder="e.g. 0000123456789" className="input w-full" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Salary payer bank account</span>
        <Select
          name="wpsPayerBankId"
          defaultValue={payerBankId}
          searchable={false}
          placeholder="Choose the account salaries are paid from…"
          options={[{ value: "", label: "Not set" }, ...banks.map((b) => ({ value: b.id, label: b.label }))]}
        />
        <span className="mt-1 block text-xs text-muted">
          Accounts come from <Link href="/banks" className="text-[var(--brand-primary)] hover:underline">Business Partners → Banks</Link>.
          {selected && !selected.complete && " This account is missing its routing code or IBAN — add them there, or the WPS file can't be built."}
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save payroll details"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}
        {state.ok && <p role="status" className="text-sm text-[var(--success-text,#067647)]">Saved.</p>}
      </div>
    </form>
  );
}
