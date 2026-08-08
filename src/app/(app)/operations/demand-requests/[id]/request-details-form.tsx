"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { updateDemandRequestAction } from "../actions";

type Request = {
  id: string;
  status: string;
  priority: string | null;
  salesExecutive: string | null;
  accommodationStatus: string | null;
  transportationStatus: string | null;
  remarks: string | null;
};

export function RequestDetailsForm({ request }: { request: Request }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateDemandRequestAction(formData);
          setSaved(true);
        });
      }}
      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5"
    >
      <input type="hidden" name="requestId" value={request.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Status</span>
          <Select
            name="status"
            defaultValue={request.status}
            searchable={false}
            options={[
              { value: "Open", label: "Open" },
              { value: "Approved", label: "Approved" },
              { value: "Rejected", label: "Rejected" },
              { value: "Closed", label: "Closed" },
            ]}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Priority</span>
          <Select
            name="priority"
            defaultValue={request.priority || ""}
            placeholder="Not set"
            searchable={false}
            options={[
              { value: "Low", label: "Low" },
              { value: "Medium", label: "Medium" },
              { value: "High", label: "High" },
            ]}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Sales Executive</span>
          <input
            name="salesExecutive"
            defaultValue={request.salesExecutive || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Accommodation Status</span>
          <input
            name="accommodationStatus"
            defaultValue={request.accommodationStatus || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Transportation Status</span>
          <input
            name="transportationStatus"
            defaultValue={request.transportationStatus || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <div className="sm:col-span-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Remarks</span>
            <textarea
              name="remarks"
              defaultValue={request.remarks || ""}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && !pending && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>
    </form>
  );
}
