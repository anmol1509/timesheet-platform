"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Select } from "@/components/ui/Select";

export type IssuerPickerData = { companies: { id: string; name: string; gaps: string[] }[]; branchName: string; defaultId: string | null };

/**
 * "Issued by": which of your own companies a timesheet is issued by, and so whose name, address, TRN and logo head it.
 * Not shown when there are no own companies, so a single-company setup looks exactly as before. An own company that is
 * missing something the header uses says so here, with a link to complete it.
 */
export function IssuerPicker({ data, value, onChange, compact = false }: { data: IssuerPickerData; value: string; onChange: (id: string) => void; compact?: boolean }) {
  if (data.companies.length === 0) return null;
  const chosen = data.companies.find((c) => c.id === value) ?? null;
  return (
    <div className={compact ? "" : "mt-4"}>
      <p className="mb-1 text-xs font-medium text-muted">Issued by</p>
      <Select
        value={value}
        onChange={onChange}
        searchable={false}
        options={[{ value: "", label: `${data.branchName} (branch details)` }, ...data.companies.map((c) => ({ value: c.id, label: c.name }))]}
      />
      {chosen && chosen.gaps.length > 0 && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--warning)]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {chosen.name} has no {chosen.gaps.join(", ")} on file, so the sheet prints without {chosen.gaps.length === 1 ? "it" : "them"}.{" "}
            <Link href={`/suppliers/${chosen.id}`} className="font-medium underline">Complete the company profile</Link>
          </span>
        </p>
      )}
    </div>
  );
}
