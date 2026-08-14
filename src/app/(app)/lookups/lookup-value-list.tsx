"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import {
  countLookupValueUsageAction,
  deleteLookupValueAction,
  toggleLookupValueActiveAction,
} from "./actions";

type Row = { id: string; value: string; isActive: boolean };

export function LookupValueList({ values }: { values: Row[] }) {
  const [pending, startTransition] = useTransition();
  // Fetched on hover/focus so the confirm text can say how many records still
  // carry the value, without counting every row up front on page load.
  const [usage, setUsage] = useState<Record<string, number>>({});

  function loadUsage(id: string) {
    if (usage[id] !== undefined) return;
    countLookupValueUsageAction(id)
      .then((count) => setUsage((u) => ({ ...u, [id]: count })))
      .catch(() => {});
  }

  function toggle(id: string) {
    const formData = new FormData();
    formData.append("lookupValueId", id);
    startTransition(() => {
      toggleLookupValueActiveAction(formData);
    });
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
          <tr>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {values.map((v) => (
            <tr key={v.id}>
              <td className="px-4 py-3 text-primary">{v.value}</td>
              <td className="px-4 py-3">
                <Badge color={v.isActive ? "green" : "slate"}>
                  {v.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td
                className="px-4 py-3 text-right whitespace-nowrap"
                onMouseEnter={() => loadUsage(v.id)}
                onFocus={() => loadUsage(v.id)}
              >
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(v.id)}
                  className="mr-3 text-xs font-medium text-blue-600 hover:underline disabled:opacity-60"
                >
                  {v.isActive ? "Deactivate" : "Activate"}
                </button>
                <DeleteButton
                  action={deleteLookupValueAction}
                  hiddenFields={{ lookupValueId: v.id }}
                  confirmMessage={
                    usage[v.id]
                      ? `Delete "${v.value}"? ${usage[v.id]} record(s) still carry this value — they keep it, but it won't be offered in dropdowns any more. Deactivating hides it without touching the list.`
                      : `Delete "${v.value}"? It will no longer be offered in dropdowns.`
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
