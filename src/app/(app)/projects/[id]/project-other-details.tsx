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
      className="card space-y-4 p-6"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">
          Notes / description
        </span>
        <textarea
          name="description"
          rows={6}
          defaultValue={description || ""}
          placeholder="Anything else worth recording about this project."
          className="input w-full"
        />
      </label>
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
