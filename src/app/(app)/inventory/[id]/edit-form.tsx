"use client";

import { useTransition } from "react";
import { updateInventoryItemAction } from "../actions";
import { Field } from "@/components/form/Field";
import { Section } from "@/components/form/Section";

export function EditItemForm({
  item,
}: {
  item: { id: string; category: string | null; notes: string | null };
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => updateInventoryItemAction(formData))}
    >
      <input type="hidden" name="itemId" value={item.id} />
      <Section title="Details">
        <Field label="Category">
          <input
            name="category"
            defaultValue={item.category ?? ""}
            className="input w-full"
          />
        </Field>
        <Field label="Notes">
          <input
            name="notes"
            defaultValue={item.notes ?? ""}
            className="input w-full"
          />
        </Field>
      </Section>
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
