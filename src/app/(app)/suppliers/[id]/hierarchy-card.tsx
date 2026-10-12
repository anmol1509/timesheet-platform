"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { setSupplierParentAction } from "../actions";

/** Switch a supplier between primary and subsidiary. Every change goes through
 * a confirmation dialog — moving a company in the hierarchy regroups its
 * documents, so it shouldn't happen from a stray click. */
export function SupplierHierarchyCard({
  supplierId,
  supplierName,
  parent,
  subsidiaryCount,
  primaryOptions,
}: {
  supplierId: string;
  supplierName: string;
  parent: { id: string; name: string } | null;
  subsidiaryCount: number;
  primaryOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply(parentId: string | null) {
    setError(null);
    return new Promise<void>((resolve) => {
      start(async () => {
        const res = await setSupplierParentAction(supplierId, parentId);
        if (res.error) setError(res.error);
        else {
          setTarget("");
          router.refresh();
        }
        resolve();
      });
    });
  }

  const targetName = primaryOptions.find((p) => p.id === target)?.name;
  const options = primaryOptions.filter((p) => p.id !== parent?.id);

  const picker = (label: string, note: string) => (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-label={label}
        className="input min-w-[200px] flex-1"
      >
        <option value="">Choose a primary supplier…</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <ConfirmDialog
        title={label}
        danger={false}
        confirmLabel="Yes, move it"
        description={`${supplierName} will become a subsidiary of ${targetName ?? "the selected supplier"}. ${note}`}
        onConfirm={() => apply(target)}
        trigger={(open) => (
          <button type="button" onClick={open} disabled={!target} className="btn btn-secondary btn-sm disabled:opacity-50">
            {label}
          </button>
        )}
      />
    </div>
  );

  return (
    <div className="card space-y-3 p-4">
      <div>
        <h3 className="text-xs font-semibold tracking-wide text-subtle uppercase">Supplier hierarchy</h3>
        <p className="mt-1 text-sm text-secondary">
          {parent ? (
            <>
              <strong>{supplierName}</strong> is a subsidiary of <strong>{parent.name}</strong>.
            </>
          ) : subsidiaryCount > 0 ? (
            <>
              <strong>{supplierName}</strong> is a primary supplier with {subsidiaryCount} subsidiar
              {subsidiaryCount === 1 ? "y" : "ies"}.
            </>
          ) : (
            <>
              <strong>{supplierName}</strong> is a primary supplier.
            </>
          )}
        </p>
      </div>

      {parent && (
        <div className="space-y-3">
          <ConfirmDialog
            title="Make primary supplier"
            danger={false}
            confirmLabel="Yes, make primary"
            description={`${supplierName} will become a primary supplier and will no longer sit under ${parent.name}. Its employees, bills and history stay with it.`}
            onConfirm={() => apply(null)}
            trigger={(open) => (
              <button type="button" onClick={open} className="btn btn-secondary btn-sm">
                Make primary supplier
              </button>
            )}
          />
          {options.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-muted">Or move it under a different primary supplier:</p>
              {picker("Move subsidiary", `It will no longer sit under ${parent.name}.`)}
            </div>
          )}
        </div>
      )}

      {!parent && subsidiaryCount === 0 && options.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted">Make this supplier a subsidiary of another primary supplier:</p>
          {picker("Make subsidiary", "Its employees, bills and history stay with it.")}
        </div>
      )}

      {!parent && subsidiaryCount > 0 && (
        <p className="text-xs text-muted">
          To make it a subsidiary of another supplier, first make each of its subsidiaries a primary supplier or move
          them elsewhere.
        </p>
      )}

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
    </div>
  );
}
