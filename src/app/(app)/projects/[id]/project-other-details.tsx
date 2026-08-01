"use client";

import { useState, useTransition } from "react";
import { updateProjectOtherDetailsAction } from "../actions";

export function ProjectOtherDetails({
  projectId,
  description,
}: {
  projectId: string;
  description: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateProjectOtherDetailsAction(formData);
          setSaved(true);
        });
      }}
      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          Notes / description
        </span>
        <textarea
          name="description"
          rows={6}
          defaultValue={description || ""}
          placeholder="Anything else worth recording about this project."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
      </label>
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
