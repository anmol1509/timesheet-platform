"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { describeAuditQuery, type AuditQuery } from "@/lib/auditQuery";

/** The export, tucked behind a button so the log itself gets the page. It starts from whatever the log is filtered to. */
export function ExportDialog({ triggerClassName, query, total }: { triggerClassName?: string; query: AuditQuery; total: number }) {
  const [format, setFormat] = useState("xlsx");
  const filters = describeAuditQuery(query, {});
  const limited = total > 50_000;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName ?? "btn btn-secondary gap-1.5"}><Download className="h-4 w-4" aria-hidden />Export</button>
      </DialogTrigger>
      <DialogContent title="Export audit log" description="Everything the log is showing now, up to 50,000 entries, with dates in UAE time." className="max-w-lg">
        <form action="/api/audit-log/export" method="get" className="mt-4 space-y-4">
          {(["q", "user", "module", "action", "entityType", "entityId", "source", "batch"] as const).map((k) => query[k] ? <input key={k} type="hidden" name={k} value={query[k]} /> : null)}
          <input type="hidden" name="format" value={format === "xlsx" ? "xlsx" : "csv"} />
          {format === "csv-fields" && <input type="hidden" name="sheet" value="fields" />}

          <div className="rounded-lg bg-surface-subtle px-3 py-2.5 text-sm">
            <p className="font-medium text-primary">{total.toLocaleString("en-GB")} matching {total === 1 ? "entry" : "entries"}{limited ? " (the newest 50,000 will be exported)" : ""}</p>
            <p className="mt-0.5 text-xs text-muted">{filters.length ? filters.join(" · ") : "No filters: the whole log."}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">From</span><DatePicker name="from" defaultValue={query.from} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">To</span><DatePicker name="to" defaultValue={query.to} className="w-full" /></label>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Format</span>
            <RadioGroup
              value={format}
              onChange={setFormat}
              options={[
                { value: "xlsx", label: "Excel workbook (recommended): a summary, one line per entry, and one line per changed field" },
                { value: "csv", label: "CSV: one line per entry" },
                { value: "csv-fields", label: "CSV: one line per changed field (old and new value)" },
              ]}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild><button type="button" className="btn btn-secondary">Cancel</button></DialogClose>
            <button type="submit" className="btn btn-primary">Download</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
