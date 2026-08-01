"use client";

import { useActionState } from "react";
import { createUserAction } from "./actions";
import { Select } from "@/components/ui/Select";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-3">
      <input
        name="name"
        placeholder="Full name"
        required
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
      />
      <input
        name="password"
        type="password"
        placeholder="Temporary password (min 8 characters)"
        required
        minLength={8}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
      />
      <Select
        name="role"
        defaultValue="STAFF"
        searchable={false}
        options={[
          { value: "STAFF", label: "Staff" },
          { value: "ADMIN", label: "Admin" },
        ]}
      />
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add user"}
      </button>
    </form>
  );
}
