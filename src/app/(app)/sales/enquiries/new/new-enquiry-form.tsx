"use client";

import { useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { createEnquiryAction } from "../actions";

export function NewEnquiryForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => createEnquiryAction(formData))}
      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Client</span>
        <Select name="clientId" placeholder="Select client" options={clients.map((c) => ({ value: c.id, label: c.name }))} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Project (working name)</span>
        <input
          name="projectHint"
          placeholder="No Project exists yet at this stage"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Required trade</span>
        <input
          name="requiredTrade"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Source</span>
        <input
          name="source"
          placeholder="e.g. Referral, Website"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Remarks</span>
        <textarea
          name="remarks"
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create Enquiry"}
      </button>
    </form>
  );
}
