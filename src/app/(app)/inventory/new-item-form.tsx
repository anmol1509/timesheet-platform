"use client";

import { useActionState } from "react";
import { createInventoryItemAction } from "./actions";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { INVENTORY_CATEGORIES } from "@/lib/formLists";
import { NumberInput } from "@/components/ui/NumberInput";

export function NewItemForm() {
  const [state, formAction, pending] = useActionState(createInventoryItemAction, {
    error: null,
  });

  return (
    <form
      action={formAction}
      className="card flex flex-wrap items-end gap-3 p-4"
    >
      <label className="block flex-1 min-w-[180px]">
        <span className="mb-1 block text-xs font-medium text-muted">Item name *</span>
        <input
          name="name"
          required
          placeholder="e.g. Concrete drill"
          className="input w-full"
        />
      </label>
      <label className="block flex-1 min-w-[160px]">
        <span className="mb-1 block text-xs font-medium text-muted">Category</span>
        <ComboSelect name="category" options={INVENTORY_CATEGORIES} />
      </label>
      <label className="block w-28">
        <span className="mb-1 block text-xs font-medium text-muted">Quantity</span>
        <NumberInput name="quantity" defaultValue={0} min={0} step={1} className="w-full" />
      </label>
      {state.error && (
        <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {pending ? "Adding…" : "+ Add Item"}
      </button>
    </form>
  );
}
