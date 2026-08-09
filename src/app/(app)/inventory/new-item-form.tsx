"use client";

import { useActionState } from "react";
import { createInventoryItemAction } from "./actions";

export function NewItemForm() {
  const [state, formAction, pending] = useActionState(createInventoryItemAction, {
    error: null,
  });

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4"
    >
      <label className="block flex-1 min-w-[180px]">
        <span className="mb-1 block text-xs font-medium text-slate-500">Item name</span>
        <input
          name="name"
          required
          placeholder="e.g. Concrete drill"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
        />
      </label>
      <label className="block flex-1 min-w-[160px]">
        <span className="mb-1 block text-xs font-medium text-slate-500">Category</span>
        <input
          name="category"
          placeholder="e.g. Power tools"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
        />
      </label>
      {state.error && (
        <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
      >
        {pending ? "Adding…" : "+ Add Item"}
      </button>
    </form>
  );
}
