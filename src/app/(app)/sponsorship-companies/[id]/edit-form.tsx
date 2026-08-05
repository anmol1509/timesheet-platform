"use client";

import { useState, useTransition } from "react";
import { updateSponsorshipCompanyAction } from "../actions";
import { Section } from "@/components/form/Section";
import { Field } from "@/components/form/Field";
import { CountrySelect } from "@/components/ui/CountrySelect";

type SponsorshipCompany = {
  id: string;
  shortName: string | null;
  address: string | null;
  country: string | null;
  currency: string | null;
  phone: string | null;
  email: string | null;
  tradeLicenseNumber: string | null;
};

export function EditSponsorshipCompanyForm({
  sponsorshipCompany,
}: {
  sponsorshipCompany: SponsorshipCompany;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateSponsorshipCompanyAction(formData);
          setSaved(true);
        });
      }}
      className="space-y-6"
    >
      <input type="hidden" name="sponsorshipCompanyId" value={sponsorshipCompany.id} />

      <Section title="Company">
        <Field label="Short name">
          <input
            name="shortName"
            defaultValue={sponsorshipCompany.shortName || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Trade license number">
          <input
            name="tradeLicenseNumber"
            defaultValue={sponsorshipCompany.tradeLicenseNumber || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Country">
          <CountrySelect name="country" defaultValue={sponsorshipCompany.country || ""} />
        </Field>
        <Field label="Currency">
          <input
            name="currency"
            placeholder="e.g. AED"
            defaultValue={sponsorshipCompany.currency || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Address">
          <input
            name="address"
            defaultValue={sponsorshipCompany.address || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="Phone">
          <input
            name="phone"
            defaultValue={sponsorshipCompany.phone || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Email">
          <input
            name="email"
            type="email"
            defaultValue={sponsorshipCompany.email || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90 disabled:opacity-60"
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
