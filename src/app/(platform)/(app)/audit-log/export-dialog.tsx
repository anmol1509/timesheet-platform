"use client";

import { Download } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { AUDIT_MODULES, ENTITY_META } from "@/lib/auditPresentation";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";

/** The CSV export, tucked behind a button so the log itself gets the page. Posts to the same route as before. */
export function ExportDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="btn btn-secondary gap-1.5"><Download className="h-4 w-4" aria-hidden />Export CSV</button>
      </DialogTrigger>
      <DialogContent title="Export audit log" description="Up to 50,000 matching entries for the current branch view." className="max-w-md">
        <form action="/api/audit-log/export" method="get" className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">From</span><DatePicker name="from" className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">To</span><DatePicker name="to" className="w-full" /></label>
          </div>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Action</span>
            <Select name="action" searchable={false} options={[{ value: "", label: "All" }, { value: "CREATE", label: "Create" }, { value: "UPDATE", label: "Update" }, { value: "DELETE", label: "Delete" }]} triggerClassName="w-full" /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Record type</span>
            <Select name="entity" defaultValue="" options={[{ value: "", label: "All record types" }, ...Object.entries(ENTITY_META).map(([k, v]) => ({ value: k, label: `${v.label} — ${v.module}` }))]} /></label>
          <DialogFooter>
            <DialogClose asChild><button type="button" className="btn btn-secondary">Cancel</button></DialogClose>
            <button type="submit" className="btn btn-primary">Download CSV</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
