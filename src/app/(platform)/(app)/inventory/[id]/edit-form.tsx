"use client";

import { useState, useTransition } from "react";
import { updateInventoryItemAction } from "../actions";
import { Field } from "@/components/form/Field";
import { Section } from "@/components/form/Section";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { INVENTORY_CATEGORIES } from "@/lib/formLists";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
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
      {error && <Alert className="mt-2">{error}</Alert>}
      <Button size="btn" className="mt-3" type="submit" disabled={pending} loading={pending}>
        Save
      </Button>
    </form>
  );
}
