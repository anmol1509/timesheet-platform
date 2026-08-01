"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateProjectLocationAction } from "../actions";
import { Select } from "@/components/ui/Select";

export function ProjectLocation({
  projectId,
  siteId,
  address,
  latitude,
  longitude,
  sites,
}: {
  projectId: string;
  siteId: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  sites: { id: string; name: string }[];
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
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Site</span>
          {sites.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No sites yet.{" "}
              <Link href="/sites" className="underline">
                Add a site
              </Link>
              .
            </p>
          ) : (
            <Select
              name="siteId"
              defaultValue={siteId || ""}
              placeholder="No site"
              options={sites.map((s) => ({ value: s.id, label: s.name }))}
            />
          )}
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Address
          </span>
          <input
            name="address"
            defaultValue={address || ""}
            placeholder="Free-text location, used alongside or instead of a formal Site"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
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
