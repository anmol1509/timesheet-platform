"use client";

import { useState, useTransition } from "react";
import { updateSupplierAction } from "../actions";

type Supplier = {
  id: string;
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

export function EditSupplierForm({ supplier }: { supplier: Supplier }) {
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
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="supplierId" value={supplier.id} />

      <Section title="Company">
        <Field label="Full name (for letterhead)">
          <input
            name="fullName"
            defaultValue={supplier.fullName || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue={supplier.status}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="ACTIVE">Active</option>
            <option value="BLACKLISTED">Blacklisted</option>
          </select>
        </Field>
        <Field label="MOHRE manpower supply permit #">
          <input
            name="mohrePermitNumber"
            defaultValue={supplier.mohrePermitNumber || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Trade license number">
          <input
            name="tradeLicenseNumber"
            defaultValue={supplier.tradeLicenseNumber || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Trade license expiry">
          <input
            name="tradeLicenseExpiry"
            type="date"
            defaultValue={supplier.tradeLicenseExpiry}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="Contact person">
          <input
            name="contactPerson"
            defaultValue={supplier.contactPerson || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Contact phone">
          <input
            name="contactPhone"
            defaultValue={supplier.contactPhone || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Contact email">
          <input
            name="contactEmail"
            type="email"
            defaultValue={supplier.contactEmail || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
      </Section>

      <Section title="Payment">
        <Field label="Bank name">
          <input
            name="bankName"
            defaultValue={supplier.bankName || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="IBAN">
          <input
            name="iban"
            defaultValue={supplier.iban || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Payment terms">
          <input
            name="paymentTerms"
            placeholder="e.g. Net 30"
            defaultValue={supplier.paymentTerms || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
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
          className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90 disabled:opacity-60"
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
