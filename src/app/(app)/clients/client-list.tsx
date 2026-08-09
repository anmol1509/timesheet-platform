"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { toCsv, downloadCsv } from "@/lib/csv";
import { complianceRowClass, type ComplianceStatus } from "@/lib/compliance";
import { useRowSelection } from "@/lib/useRowSelection";
import { bulkImportClientsAction } from "./actions";

const PAGE_SIZE = 25;

type ClientRow = {
  id: string;
  name: string;
  code: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  basicRate: number | null;
  hourlyRate: number | null;
  contractStart: string | null;
  contractEnd: string | null;
  status: string;
  licenseStatus: ComplianceStatus;
};

const IMPORT_COLUMNS = [
  { key: "name", label: "Company name", required: true },
  { key: "contactPerson", label: "Contact person" },
  { key: "contactEmail", label: "Contact email" },
  { key: "contactPhone", label: "Contact phone" },
  { key: "trn", label: "TRN" },
  { key: "tradeLicenseNumber", label: "Trade license number" },
];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ClientList({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code || "").toLowerCase().includes(q) ||
        (c.contactPerson || "").toLowerCase().includes(q)
    );
  }, [clients, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const { selected, toggle, toggleAll, allSelected, clear } = useRowSelection(
    filtered.map((c) => c.id)
  );

  function exportCsv() {
    const rows = selected.size > 0 ? filtered.filter((c) => selected.has(c.id)) : filtered;
    const csv = toCsv(rows, [
      { header: "Company", value: (c) => c.name },
      { header: "Code", value: (c) => c.code },
      { header: "Contact Person", value: (c) => c.contactPerson },
      { header: "Contact Email", value: (c) => c.contactEmail },
      { header: "Contact Phone", value: (c) => c.contactPhone },
      { header: "Basic Rate (AED)", value: (c) => c.basicRate },
      { header: "Hourly Rate (AED)", value: (c) => c.hourlyRate },
      { header: "Contract Start", value: (c) => fmtDate(c.contractStart) },
      { header: "Contract End", value: (c) => fmtDate(c.contractEnd) },
      { header: "Status", value: (c) => c.status },
    ]);
    downloadCsv(`clients-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients by company name, code, or contact person..."
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
        />
        <div className="flex shrink-0 items-center gap-2">
          <CsvImportDialog
            entityLabel="clients"
            columns={IMPORT_COLUMNS}
            importAction={bulkImportClientsAction}
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
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          All Clients
        </h2>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} />
                </th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Contact Person</th>
                <th className="px-4 py-3">Contact Info</th>
                <th className="px-4 py-3">Rates (AED)</th>
                <th className="px-4 py-3">Contract Period</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((c) => (
                <tr key={c.id} className={complianceRowClass(c.licenseStatus) || "hover:bg-slate-50"}>
                  <td className="px-4 py-3">
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/clients/${c.id}`}>{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.code || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.contactPerson || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.contactEmail && <div>{c.contactEmail}</div>}
                    {c.contactPhone && (
                      <div className="text-xs text-slate-400">
                        {c.contactPhone}
                      </div>
                    )}
                    {!c.contactEmail && !c.contactPhone && "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.basicRate != null && <div>Basic: AED {c.basicRate}</div>}
                    {c.hourlyRate != null && (
                      <div className="text-xs text-slate-400">
                        Hourly: AED {c.hourlyRate}
                      </div>
                    )}
                    {c.basicRate == null && c.hourlyRate == null && "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.contractStart || c.contractEnd
                      ? `${fmtDate(c.contractStart)} – ${fmtDate(c.contractEnd)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={c.status === "ACTIVE" ? "green" : "slate"}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clients/${c.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No clients match &ldquo;{query}&rdquo;.
            </p>
          )}
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
          />
        </div>
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
