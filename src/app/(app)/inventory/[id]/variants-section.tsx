"use client";

import { useRef, useState, useTransition } from "react";
import { DeleteButton } from "@/components/DeleteButton";
import { InlineEditRow } from "@/components/InlineEditRow";
import { createVariantAction, deleteVariantAction, updateVariantStockAction } from "../actions";
import { NumberInput } from "@/components/ui/NumberInput";

type Variant = { id: string; name: string; sku: string | null; stock: number; held: number };

// Amazon-style variants: the item is the product, each variant is one
// stocked option (size, colour, whatever distinguishes it) with its own
// stock count. "Available" is stock minus whatever's currently issued and
// unreturned — computed on read (see inventory/[id]/page.tsx), not stored,
// so it can't drift the way a decrement-on-issue counter could.
export function VariantsSection({ itemId, variants }: { itemId: string; variants: Variant[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const skuRef = useRef<HTMLInputElement>(null);
  const stockRef = useRef<HTMLInputElement>(null);
  const [resetKey, setResetKey] = useState(0);

  function handleAdd() {
    const name = nameRef.current?.value.trim();
    if (!name) return;
    setError(null);
    const formData = new FormData();
    formData.append("itemId", itemId);
    formData.append("name", name);
    if (skuRef.current?.value) formData.append("sku", skuRef.current.value);
    formData.append("stock", stockRef.current?.value || "0");

    startTransition(async () => {
      const result = await createVariantAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (nameRef.current) nameRef.current.value = "";
      if (skuRef.current) skuRef.current.value = "";
      setResetKey((k) => k + 1);
      if (stockRef.current) stockRef.current.value = "";
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-primary">Variants</h2>
      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">Variant name</span>
            <input ref={nameRef} placeholder="e.g. Size 42, Red - Large" className="input w-full" />
          </label>
          <label className="block min-w-[120px]">
            <span className="mb-1 block text-xs font-medium text-muted">SKU</span>
            <input ref={skuRef} placeholder="Optional" className="input w-full" />
          </label>
          <label className="block w-32">
            <span className="mb-1 block text-xs font-medium text-muted">Stock</span>
            <NumberInput key={resetKey} defaultValue={0} min={0} inputRef={stockRef} className="w-full" />
          </label>
          <button type="button" onClick={handleAdd} disabled={pending} className="btn btn-primary">
            Add variant
          </button>
        </div>

        {error && <p className="mt-2 text-xs text-[var(--error)]">{error}</p>}

        {variants.length === 0 ? (
          <p className="mt-4 text-sm text-subtle">
            No variants yet — without one, this item is issued directly (no size/colour breakdown).
          </p>
        ) : (
          <div className="mt-4 overflow-hidden overflow-x-auto rounded-card border border-default">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-3 py-2">Variant</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2 text-right">Held</th>
                  <th className="px-3 py-2 text-right">Available</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {variants.map((v) => (
                  <tr key={v.id}>
                    <td className="px-3 py-2 font-medium text-primary">{v.name}</td>
                    <td className="px-3 py-2 text-secondary">{v.sku || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <InlineEditRow
                        value={String(v.stock)}
                        fieldName="stock"
                        action={updateVariantStockAction}
                        hiddenFields={{ variantId: v.id }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">{v.held}</td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        v.stock - v.held <= 0 ? "text-[var(--error)]" : "text-primary"
                      }`}
                    >
                      {v.stock - v.held}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <DeleteButton
                        action={deleteVariantAction}
                        hiddenFields={{ variantId: v.id }}
                        confirmMessage={`Delete variant "${v.name}"?`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
