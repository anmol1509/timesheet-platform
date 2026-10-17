"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { DocumentBrowser, type DocRow } from "./document-browser";
import { MatrixViews } from "./matrix-views";
import type { MatrixEmployee, Policy } from "./matrix";
import type { CompanyAttachment, CompanySupplier } from "./company-docs";

type View = "list" | "employee" | "supplier";

/** List, one row per worker, or one row per supplier: the same documents, three ways in. */
export function DocumentsView({ documents, employees, matrixEmployees, policies, companySuppliers, companyAttachments, suppliers, projects, canBulkImport }: {
  documents: DocRow[];
  employees: { id: string; name: string; employeeIdNo: string }[];
  matrixEmployees: (MatrixEmployee & { projectName: string | null })[];
  policies: Policy[];
  companySuppliers: CompanySupplier[];
  companyAttachments: CompanyAttachment[];
  suppliers: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  canBulkImport: boolean;
}) {
  const params = useSearchParams();
  const v = params.get("view");
  const [view, setView] = useState<View>(v === "employee" || v === "supplier" ? v : "list");
  return (
    <div className="space-y-4">
      <div className="inline-flex overflow-hidden rounded-control border border-default" role="group" aria-label="View">
        {([["list", "List"], ["employee", "By employee"], ["supplier", "By supplier"]] as const).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={cn("px-4 py-1.5 text-sm font-medium transition", view === key ? "bg-[var(--brand-primary)] text-white" : "bg-surface text-secondary hover:bg-surface-hover")}>{label}</button>
        ))}
      </div>
      {view === "list" ? (
        <DocumentBrowser documents={documents} employees={employees} suppliers={suppliers} projects={projects} canBulkImport={canBulkImport} />
      ) : (
        <MatrixViews key={view} view={view} documents={documents} employees={matrixEmployees} policies={policies} companySuppliers={companySuppliers} companyAttachments={companyAttachments} suppliers={suppliers} projects={projects} />
      )}
    </div>
  );
}
