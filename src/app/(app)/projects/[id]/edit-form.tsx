"use client";

import { useState, useTransition } from "react";
import { updateProjectAction } from "../actions";

type Project = {
  id: string;
  description: string | null;
  location: string | null;
  manager: string | null;
  timelineStart: string;
  timelineEnd: string;
  status: string;
};

export function EditProjectForm({ project }: { project: Project }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateProjectAction(formData);
          setSaved(true);
        });
      }}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="projectId" value={project.id} />
      <Field label="Description">
        <textarea
          name="description"
          rows={2}
          defaultValue={project.description || ""}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Location">
          <input
            name="location"
            defaultValue={project.location || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Project manager">
          <input
            name="manager"
            defaultValue={project.manager || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue={project.status}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </Field>
        <div />
        <Field label="Timeline start">
          <input
            name="timelineStart"
            type="date"
            defaultValue={project.timelineStart}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Timeline end">
          <input
            name="timelineEnd"
            type="date"
            defaultValue={project.timelineEnd}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && !pending && (
          <span className="text-sm text-emerald-600">Saved.</span>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
