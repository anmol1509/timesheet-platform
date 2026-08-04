"use client";

import { useActionState } from "react";
import { createBranchAction } from "./actions";

export function CreateBranchForm() {
  const [state, formAction, pending] = useActionState(createBranchAction, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-3">
      <input
        name="code"
        placeholder="Code, e.g. DXB"
        required
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
      />
      <input
        name="name"
        placeholder="Branch name"
        required
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
      />
      <input
        name="emirate"
        placeholder="Emirate (optional)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
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
        {pending ? "Adding…" : "Add branch"}
      </button>
    </form>
  );
}
