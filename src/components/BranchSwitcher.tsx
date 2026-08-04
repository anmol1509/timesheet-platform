"use client";

import { useTransition } from "react";
import { Building2 } from "lucide-react";
import { setActiveBranchAction } from "@/app/(app)/branch-switcher-actions";

type Branch = { id: string; code: string; name: string };

export function BranchSwitcher({
  branches,
  activeBranchId,
}: {
  branches: Branch[];
  activeBranchId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    const formData = new FormData();
    formData.set("branchId", value === "ALL" ? "" : value);
    startTransition(() => {
      setActiveBranchAction(formData);
    });
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600">
      <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
      <select
        value={activeBranchId ?? "ALL"}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="bg-transparent text-sm font-medium text-slate-700 outline-none disabled:opacity-60"
      >
        <option value="ALL">All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.code} — {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
