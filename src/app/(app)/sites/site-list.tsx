"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { InlineEditRow } from "@/components/InlineEditRow";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useRowSelection } from "@/lib/useRowSelection";
import { bulkImportSitesAction, updateSiteAction, deleteSiteAction } from "./actions";

type SiteRow = {
  id: string;
  name: string;
  projectCount: number;
  employeeCount: number;
};

const IMPORT_COLUMNS = [{ key: "name", label: "Site name", required: true }];

export function SiteList({ sites }: { sites: SiteRow[] }) {
  const router = useRouter();
  const { selected, toggle, toggleAll, allSelected, clear } = useRowSelection(
    sites.map((s) => s.id)
  );

  function exportCsv() {
    const rows = selected.size > 0 ? sites.filter((s) => selected.has(s.id)) : sites;
    const csv = toCsv(rows, [
      { header: "Site", value: (s) => s.name },
      { header: "Projects", value: (s) => s.projectCount },
      { header: "Employees", value: (s) => s.employeeCount },
    ]);
    downloadCsv(`sites-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <CsvImportDialog
          entityLabel="sites"
          columns={IMPORT_COLUMNS}
          importAction={bulkImportSitesAction}
          onDone={() => router.refresh()}
        />
        <button
          type="button"
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          {selected.size > 0 ? `Export selected (${selected.size})` : "Export CSV"}
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} />
              </th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3 text-right">Projects</th>
              <th className="px-4 py-3 text-right">Employees</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sites.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  <InlineEditRow
                    value={s.name}
                    action={updateSiteAction}
                    hiddenFields={{ siteId: s.id }}
                  />
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{s.projectCount}</td>
                <td className="px-4 py-3 text-right text-slate-600">{s.employeeCount}</td>
                <td className="px-4 py-3 text-right">
                  <DeleteButton
                    action={deleteSiteAction}
                    hiddenFields={{ siteId: s.id }}
                    confirmMessage={`Delete site "${s.name}"?`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected.size > 0 && (
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium text-slate-500 hover:underline"
        >
          Clear selection ({selected.size})
        </button>
      )}
    </div>
  );
}
