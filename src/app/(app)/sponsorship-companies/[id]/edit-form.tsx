"use client";

import { useState, useTransition } from "react";
import { FormSaveBar, useUnsavedGuard } from "@/components/FormSaveBar";
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
  const guard = useUnsavedGuard();

  return (
    <form
      onInput={guard.onInput}
      action={(formData) => {
        setSaved(false);
        guard.markSaved();
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
            className="input w-full"
          />
        </Field>
        <Field label="Trade license number">
          <input
            name="tradeLicenseNumber"
            defaultValue={sponsorshipCompany.tradeLicenseNumber || ""}
            className="input w-full"
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
            className="input w-full"
          />
        </Field>
        <Field label="Address">
          <input
            name="address"
            defaultValue={sponsorshipCompany.address || ""}
            className="input w-full"
          />
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="Phone">
          <input
            name="phone"
            defaultValue={sponsorshipCompany.phone || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Email">
          <input
            name="email"
            type="email"
            defaultValue={sponsorshipCompany.email || ""}
            className="input w-full"
          />
        </Field>
      </Section>

      <FormSaveBar pending={pending} saved={saved} dirty={guard.dirty} />
    </form>
  );
}
