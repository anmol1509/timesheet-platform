"use client";

import { useState, useTransition } from "react";
import { updateDemandRequestAction } from "../actions";

type Request = {
  id: string;
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
      className="card space-y-4 p-5"
    >
      <input type="hidden" name="requestId" value={request.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Remarks</span>
            <textarea
              name="remarks"
              defaultValue={request.remarks || ""}
              rows={2}
              className="input w-full"
            />
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && !pending && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>
    </form>
  );
}
