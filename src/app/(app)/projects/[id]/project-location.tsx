"use client";

import { useState, useTransition } from "react";
import { updateProjectLocationAction } from "../actions";

export function ProjectLocation({
  projectId,
  address,
  latitude,
  longitude,
}: {
  projectId: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateProjectLocationAction(formData);
          setSaved(true);
        });
      }}
      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Address
          </span>
          <input
            name="address"
            defaultValue={address || ""}
            placeholder="Free-text location"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Latitude
          </span>
          <input
            name="latitude"
            type="number"
            step="any"
            defaultValue={latitude ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Longitude
          </span>
          <input
            name="longitude"
            type="number"
            step="any"
            defaultValue={longitude ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && !pending && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>
    </form>
  );
}
