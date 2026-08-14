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
    <div className="flex h-9 min-w-0 items-center gap-1.5 rounded-control border border-default bg-surface-subtle px-2 text-sm text-secondary transition hover:bg-surface-hover">
      <Building2 className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
      <select
        aria-label="Active branch"
        value={activeBranchId ?? "ALL"}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        // Caps the control so a long branch name can't push the account menu
        // off a narrow header.
        className="min-w-0 max-w-28 cursor-pointer truncate bg-transparent text-xs font-medium text-secondary outline-none disabled:opacity-60 sm:max-w-40 sm:text-sm"
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
