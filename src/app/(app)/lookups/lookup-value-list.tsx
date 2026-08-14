"use client";

import { useTransition } from "react";
import { Badge } from "@/components/Badge";
import { toggleLookupValueActiveAction } from "./actions";

type Row = { id: string; value: string; isActive: boolean };

export function LookupValueList({ values }: { values: Row[] }) {
  const [pending, startTransition] = useTransition();

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
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(v.id)}
                  className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-60"
                >
                  {v.isActive ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
