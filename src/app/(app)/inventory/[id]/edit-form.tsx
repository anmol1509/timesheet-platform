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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Notes">
          <input
            name="notes"
            defaultValue={item.notes ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
      </Section>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
