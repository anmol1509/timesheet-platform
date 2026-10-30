"use client";

import { keepInput } from "@/lib/vendor/keepInput";
import { useActionState } from "react";
import Link from "next/link";
import { createProjectAction } from "../actions";
import { PersonField } from "@/components/form/PersonField";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";

import { Button } from "@/components/ui/Button";
export function NewProjectForm({
  clients,
}: {
  clients: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createProjectAction, {
    error: null,
  });

  return (
    <div className="form-comfy max-w-5xl space-y-6">
      <div>
        <Link href="/projects" className="text-sm text-muted hover:underline">
          ← Projects
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary">
          Add Project
        </h1>
      </div>

      <form
        onSubmit={keepInput(formAction)}
        className="card space-y-6 p-8"
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
                rows={3}
                className="input w-full"
              />
            </Field>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
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

            <Button size="btn" type="submit" disabled={pending} loading={pending}>
              Add Project
            </Button>
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
