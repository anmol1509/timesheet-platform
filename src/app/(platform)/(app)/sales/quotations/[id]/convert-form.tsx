"use client";

import { useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { convertQuotationToProjectAction } from "../actions";

import { Button } from "@/components/ui/Button";
export function ConvertToProjectForm({ quotationId }: { quotationId: string }) {
  const [pending, startTransition] = useTransition();
  const [createLpos, setCreateLpos] = useState(true);
  const [createDemand, setCreateDemand] = useState(true);

  function submit() {
    const formData = new FormData();
    formData.append("quotationId", quotationId);
    if (createLpos) formData.append("createLpos", "on");
    if (createDemand) formData.append("createDemand", "on");
    startTransition(() => convertQuotationToProjectAction(formData));
  }

  return (
    <div className="rounded-xl border border-[var(--success-border)] bg-[var(--success-soft)] p-5">
      <h2 className="mb-2 text-sm font-semibold text-primary">Accepted: create the project</h2>
      <p className="mb-3 text-sm text-secondary">
        One step: creates the project for this client, marks the quotation as converted, and (if ticked) raises the demand.
      </p>
      <div className="mb-3 space-y-2">
        <Checkbox checked={createDemand} onCheckedChange={setCreateDemand} label="Also raise the labour demand for these workers (trades and quantities from the lines)" />
        <Checkbox
          checked={createLpos}
          onCheckedChange={setCreateLpos}
          label="Also create an LPO per line item (using this quotation's rates)"
        />
      </div>
      <Button size="btn" type="button" disabled={pending} onClick={submit} loading={pending}>
        Create project
      </Button>
    </div>
  );
}
