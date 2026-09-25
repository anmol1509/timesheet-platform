"use client";

import { CitySelect } from "@/components/ui/CitySelect";
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
        className="input w-full"
      />
      <input
        name="name"
        placeholder="Branch name"
        required
        className="input w-full"
      />
      <CitySelect name="emirate" country={null} />
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary w-full px-3"
      >
        {pending ? "Adding…" : "Add branch"}
      </button>
    </form>
  );
}
