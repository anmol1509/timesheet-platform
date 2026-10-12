"use client";

import { useState, useTransition } from "react";
import { updateInventoryItemAction } from "../actions";
import { Field } from "@/components/form/Field";
import { Section } from "@/components/form/Section";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { INVENTORY_CATEGORIES } from "@/lib/formLists";

export function EditItemForm({
  item,
}: {
  item: { id: string; name: string; category: string | null; notes: string | null };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) => startTransition(async () => { const res = await updateInventoryItemAction(formData); setError(res.error); })}
    >
      <input type="hidden" name="itemId" value={item.id} />
      <Section title="Details">
        <Field label="Item name">
          <input name="name" required maxLength={200} defaultValue={item.name} className="input w-full" />
        </Field>
        <Field label="Category">
          <ComboSelect name="category" options={INVENTORY_CATEGORIES} defaultValue={item.category} />
        </Field>
        <Field label="Notes">
          <input
            name="notes"
            defaultValue={item.notes ?? ""}
            className="input w-full"
          />
        </Field>
      </Section>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--error)]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-3"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
