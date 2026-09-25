"use client";

import { Download } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { AUDIT_MODULES, ENTITY_META } from "@/lib/auditPresentation";

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
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">From</span><input type="date" name="from" className="input w-full" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">To</span><input type="date" name="to" className="input w-full" /></label>
          </div>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Action</span>
            <select name="action" className="input w-full"><option value="">All</option><option value="CREATE">Create</option><option value="UPDATE">Update</option><option value="DELETE">Delete</option></select></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Record type</span>
            <select name="entity" className="input w-full"><option value="">All record types</option>
              {AUDIT_MODULES.map((m) => (
                <optgroup key={m} label={m}>{Object.entries(ENTITY_META).filter(([, v]) => v.module === m).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</optgroup>
              ))}
            </select></label>
          <DialogFooter>
            <DialogClose asChild><button type="button" className="btn btn-secondary">Cancel</button></DialogClose>
            <button type="submit" className="btn btn-primary">Download CSV</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
