"use client";

import { useState, useTransition } from "react";
import { updateBankAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/form/Field";
import { Section } from "@/components/form/Section";

type Bank = {
  id: string;
  accountName: string;
  bankName: string;
  abbreviation: string | null;
  accountNo: string | null;
  ibanNo: string | null;
  routingCode: string | null;
  swiftCode: string | null;
  bankBranch: string | null;
  address: string | null;
  remarks: string | null;
  status: string;
};

export function EditBankForm({ bank }: { bank: Bank }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateBankAction(formData);
          setSaved(true);
        });
      }}
      className="space-y-6"
    >
      <input type="hidden" name="bankId" value={bank.id} />
      <input type="hidden" name="accountName" value={bank.accountName} />
      <input type="hidden" name="bankName" value={bank.bankName} />

      <Section title="Bank details">
        <Field label="Abbreviation">
          <input
            name="abbreviation"
            defaultValue={bank.abbreviation || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Status">
          <Select
            name="status"
            defaultValue={bank.status}
            searchable={false}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
        </Field>
        <Field label="Account number">
          <input
            name="accountNo"
            defaultValue={bank.accountNo || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="IBAN number">
          <input
            name="ibanNo"
            defaultValue={bank.ibanNo || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Routing code">
          <input
            name="routingCode"
            defaultValue={bank.routingCode || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Swift code">
          <input
            name="swiftCode"
            defaultValue={bank.swiftCode || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Bank branch">
          <input
            name="bankBranch"
            defaultValue={bank.bankBranch || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Address">
          <input
            name="address"
            defaultValue={bank.address || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Remarks">
          <input
            name="remarks"
            defaultValue={bank.remarks || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
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
