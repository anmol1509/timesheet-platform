"use client";

import { useState, useTransition } from "react";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { updateCampOwnershipAction } from "../actions";

type SupplierOption = { id: string; name: string };

export function CampOwnershipEditor({
  campId,
  ownerType,
  owningSupplierId,
  suppliers,
}: {
  campId: string;
  ownerType: string;
  owningSupplierId: string | null;
  suppliers: SupplierOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [draftType, setDraftType] = useState<"OWN" | "SUPPLIER">(ownerType === "SUPPLIER" ? "SUPPLIER" : "OWN");
  const [draftSupplierId, setDraftSupplierId] = useState(owningSupplierId || "");
  const [pending, startTransition] = useTransition();

  const currentSupplierName = suppliers.find((s) => s.id === owningSupplierId)?.name;

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            ownerType === "SUPPLIER" ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-[var(--info-soft)] text-[var(--brand-primary)]"
          }`}
        >
          {ownerType === "SUPPLIER" ? `Supplier camp${currentSupplierName ? ` — ${currentSupplierName}` : ""}` : "Own camp"}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-medium text-subtle hover:text-secondary hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        value={draftType}
        onChange={(v) => setDraftType(v as "OWN" | "SUPPLIER")}
        options={[
          { value: "OWN", label: "Own" },
          { value: "SUPPLIER", label: "Supplier" },
        ]}
      />
      {draftType === "SUPPLIER" && (
        <Select
          value={draftSupplierId}
          onChange={setDraftSupplierId}
          placeholder="Select a supplier"
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          triggerClassName="min-w-[180px]"
        />
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const formData = new FormData();
          formData.append("campId", campId);
          formData.append("ownerType", draftType);
          if (draftType === "SUPPLIER" && draftSupplierId) formData.append("supplierId", draftSupplierId);
          startTransition(async () => {
            await updateCampOwnershipAction(formData);
            setEditing(false);
          });
        }}
        className="btn btn-primary px-2 py-1 text-xs"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-subtle hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}
