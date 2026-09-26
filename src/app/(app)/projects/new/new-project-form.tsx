"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createProjectAction } from "../actions";
import { PersonField } from "@/components/form/PersonField";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";

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
          <p className="rounded-lg bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">
            {state.error}
          </p>
        )}

        {clients.length === 0 ? (
          <p className="rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
            You need at least one client before adding a project.{" "}
            <Link href="/clients/new" className="underline">
              Add a client
            </Link>{" "}
            first.
          </p>
        ) : (
          <>
            <Field required label="Project name">
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
              <Field required label="Client">
                <Select
                  name="clientId"
                  required
                  defaultValue={clients[0]?.id}
                  options={clients.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <PersonField name="manager" label="Project manager" />
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
                <DatePicker name="timelineStart" className="w-full" />
              </Field>
              <Field label="Timeline end">
                <DatePicker name="timelineEnd" className="w-full" />
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

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
        {required && <span className="text-[var(--error)]"> *</span>}
      </span>
      {children}
    </label>
  );
}
