"use client";

import { useState, useTransition } from "react";
import { updateProjectLocationAction } from "../actions";
import { NumberInput } from "@/components/ui/NumberInput";

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
      className="card space-y-4 p-6"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-muted">
            Address
          </span>
          <input
            name="address"
            defaultValue={address || ""}
            placeholder="Free-text location"
            className="input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Latitude
          </span>
          <NumberInput name="latitude" defaultValue={latitude ?? ""} step={0.000001} className="w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Longitude
          </span>
          <NumberInput name="longitude" defaultValue={longitude ?? ""} step={0.000001} className="w-full" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && !pending && <span className="text-sm text-[var(--success)]">Saved.</span>}
      </div>
    </form>
  );
}
