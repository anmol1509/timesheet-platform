"use client";

import { useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { createEnquiryAction } from "../actions";

export function NewEnquiryForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => createEnquiryAction(formData))}
      className="card space-y-4 p-6"
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
        <input
          name="requiredTrade"
          className="input w-full"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Source</span>
        <input
          name="source"
          placeholder="e.g. Referral, Website"
          className="input w-full"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Remarks</span>
        <textarea
          name="remarks"
          rows={3}
          className="input w-full"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {pending ? "Creating…" : "Create Enquiry"}
      </button>
    </form>
  );
}
