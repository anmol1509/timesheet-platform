"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { DocumentBrowser, type DocRow } from "./document-browser";
import { MatrixViews } from "./matrix-views";
import type { MatrixEmployee, Policy } from "./matrix";
import type { CompanyAttachment, CompanySupplier } from "./company-docs";

type View = "list" | "employee" | "supplier";

/** List, one row per worker, or one row per supplier: the same documents, three ways in. */
export function DocumentsView({ documents, employees, matrixEmployees, policies, companySuppliers, companyAttachments, certsInUse, suppliers, projects, canBulkImport }: {
  documents: DocRow[];
  employees: { id: string; name: string; employeeIdNo: string }[];
  matrixEmployees: (MatrixEmployee & { projectName: string | null })[];
  policies: Policy[];
  companySuppliers: CompanySupplier[];
  companyAttachments: CompanyAttachment[];
  certsInUse: string[];
  suppliers: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  canBulkImport: boolean;
}) {
  const params = useSearchParams();
  const v = params.get("view");
  const [view, setView] = useState<View>(v === "employee" || v === "supplier" ? v : "list");
  // A click in the chart above shows the list, filtered, and scrolls to it. If another view is open the list has to
  // mount first, so the request is sent once more after it has.
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => {
    const on = (e: Event) => {
      const scroll = () => document.getElementById("document-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (viewRef.current !== "list") {
        setView("list");
        const detail = (e as CustomEvent).detail;
        setTimeout(() => { window.dispatchEvent(new CustomEvent("documents:filter", { detail })); scroll(); }, 80);
      } else setTimeout(scroll, 30);
    };
    window.addEventListener("documents:filter", on);
    return () => window.removeEventListener("documents:filter", on);
  }, []);
  return (
    <div id="document-list" className="scroll-mt-24 space-y-4">
      <div className="inline-flex overflow-hidden rounded-control border border-default" role="group" aria-label="View">
        {([["list", "List"], ["employee", "By employee"], ["supplier", "By supplier"]] as const).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={cn("px-4 py-1.5 text-sm font-medium transition", view === key ? "bg-[var(--brand-primary)] text-white" : "bg-surface text-secondary hover:bg-surface-hover")}>{label}</button>
        ))}
      </div>
      {view === "list" ? (
        <DocumentBrowser documents={documents} employees={employees} suppliers={suppliers} projects={projects} canBulkImport={canBulkImport} />
      ) : (
        <MatrixViews key={view} view={view} documents={documents} employees={matrixEmployees} policies={policies} companySuppliers={companySuppliers} companyAttachments={companyAttachments} certsInUse={certsInUse} suppliers={suppliers} projects={projects} />
      )}
    </div>
  );
}
