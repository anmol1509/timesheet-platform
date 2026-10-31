"use client";

import { useTradeNames } from "@/components/TradesProvider";
import { useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { createEnquiryAction } from "../actions";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { ENQUIRY_SOURCES } from "@/lib/formLists";

import { Button } from "@/components/ui/Button";
export function NewEnquiryForm({ clients }: { clients: { id: string; name: string }[] }) {
  const tradeNames = useTradeNames();
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => createEnquiryAction(formData))}
      className="card grid grid-cols-1 items-start gap-x-6 gap-y-5 p-8 md:grid-cols-2"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Client</span>
        <Select name="clientId" placeholder="Select client" options={clients.map((c) => ({ value: c.id, label: c.name }))} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Project (working name)</span>
        <input
          name="projectHint"
          placeholder="No Project exists yet at this stage"
          className="input w-full"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Required trade</span>
        <Select name="requiredTrade" searchable options={[{ value: "", label: "Not set" }, ...tradeNames.map((t) => ({ value: t, label: t }))]} defaultValue="" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Source</span>
        <ComboSelect name="source" options={ENQUIRY_SOURCES} />
      </label>
      <label className="block md:col-span-2">
        <span className="mb-1 block text-xs font-medium text-muted">Remarks</span>
        <textarea
          name="remarks"
          rows={3}
          className="input w-full"
        />
      </label>
      <div className="md:col-span-2">
        <Button size="btn" type="submit" disabled={pending} loading={pending}>
          Create Enquiry
        </Button>
      </div>
    </form>
  );
}
