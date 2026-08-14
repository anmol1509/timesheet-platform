"use client";

import { useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { convertQuotationToProjectAction } from "../actions";

export function ConvertToProjectForm({ quotationId }: { quotationId: string }) {
  const [pending, startTransition] = useTransition();
  const [createLpos, setCreateLpos] = useState(true);

  function submit() {
    const formData = new FormData();
    formData.append("quotationId", quotationId);
    if (createLpos) formData.append("createLpos", "on");
    startTransition(() => convertQuotationToProjectAction(formData));
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <h2 className="mb-2 text-sm font-semibold text-primary">Convert to Project</h2>
      <p className="mb-3 text-sm text-secondary">
        Creates a Project for this client and marks the quotation as converted.
      </p>
      <div className="mb-3">
        <Checkbox
          checked={createLpos}
          onCheckedChange={setCreateLpos}
          label="Also create an LPO per line item (using this quotation's rates)"
        />
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="btn btn-primary"
      >
        {pending ? "Converting…" : "Convert to Project"}
      </button>
    </div>
  );
}
