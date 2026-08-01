"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createProjectAction } from "../actions";
import { Select } from "@/components/ui/Select";

export function NewProjectForm({
  clients,
  sites,
}: {
  clients: { id: string; name: string }[];
  sites: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createProjectAction, {
    error: null,
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/projects" className="text-sm text-slate-500 hover:underline">
          ← Projects
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Add Project
        </h1>
      </div>

      <form
        action={formAction}
        className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6"
      >
        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        {clients.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            You need at least one client before adding a project.{" "}
            <Link href="/clients/new" className="underline">
              Add a client
            </Link>{" "}
            first.
          </p>
        ) : (
          <>
            <Field label="Project name">
              <input
                name="name"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Client">
                <Select
                  name="clientId"
                  required
                  defaultValue={clients[0]?.id}
                  options={clients.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <Field label="Site">
                {sites.length === 0 ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    No sites yet.{" "}
                    <Link href="/sites" className="underline">
                      Add a site
                    </Link>{" "}
                    to link this project to a location.
                  </p>
                ) : (
                  <Select
                    name="siteId"
                    placeholder="No site"
                    options={sites.map((s) => ({ value: s.id, label: s.name }))}
                  />
                )}
              </Field>
              <Field label="Project manager">
                <input
                  name="manager"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                />
              </Field>
              <Field label="Status">
                <Select
                  name="status"
                  defaultValue="PLANNING"
                  searchable={false}
                  options={[
                    { value: "PLANNING", label: "Planning" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "ON_HOLD", label: "On Hold" },
                    { value: "COMPLETED", label: "Completed" },
                  ]}
                />
              </Field>
              <Field label="Timeline start">
                <input
                  name="timelineStart"
                  type="date"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                />
              </Field>
              <Field label="Timeline end">
                <input
                  name="timelineEnd"
                  type="date"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Add Project"}
            </button>
          </>
        )}
      </form>
    </div>
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
