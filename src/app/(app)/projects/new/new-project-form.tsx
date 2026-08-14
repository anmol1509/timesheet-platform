"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createProjectAction } from "../actions";
import { Select } from "@/components/ui/Select";

export function NewProjectForm({
  clients,
}: {
  clients: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createProjectAction, {
    error: null,
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/projects" className="text-sm text-muted hover:underline">
          ← Projects
        </Link>
        <h1 className="text-xl tracking-tight text-primary mt-2 font-semibold">
          Add Project
        </h1>
      </div>

      <form
        action={formAction}
        className="card space-y-4 p-6"
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
                className="input w-full"
              />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                rows={2}
                className="input w-full"
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
              <Field label="Project manager">
                <input
                  name="manager"
                  className="input w-full"
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
                  className="input w-full"
                />
              </Field>
              <Field label="Timeline end">
                <input
                  name="timelineEnd"
                  type="date"
                  className="input w-full"
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary"
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
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
