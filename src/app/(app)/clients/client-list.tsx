"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Pencil } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { toCsv, downloadCsv } from "@/lib/csv";
import { complianceRowClass, type ComplianceStatus } from "@/lib/compliance";
import { useRowSelection } from "@/lib/useRowSelection";
import { bulkImportClientsAction } from "./actions";
import { DeleteButton } from "@/components/DeleteButton";
import { DeleteClientsButton } from "./delete-clients-button";
import { deleteClientAction } from "./actions";

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
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | "active" | "inactive">(
    initialStatus === "active" || initialStatus === "inactive" ? initialStatus : "all"
  );

  const byStatus = useMemo(() => {
    if (status === "active") return clients.filter((c) => c.status === "ACTIVE");
    if (status === "inactive") return clients.filter((c) => c.status !== "ACTIVE");
    return clients;
  }, [clients, status]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code || "").toLowerCase().includes(q) ||
        (c.contactPerson || "").toLowerCase().includes(q)
    );
  }, [byStatus, query]);

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Four of these columns were "—" for nearly every client, crowding out the
  // ones carrying data. A column that is empty for the whole list earns no
  // space; it reappears on its own as soon as anything fills it.
  const has = useMemo(
    () => ({
      contactPerson: clients.some((c) => c.contactPerson),
      contactInfo: clients.some((c) => c.contactEmail || c.contactPhone),
      rates: clients.some((c) => c.basicRate != null || c.hourlyRate != null),
      contract: clients.some((c) => c.contractStart || c.contractEnd),
    }),
    [clients]
  );

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
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients by company name, code, or contact person..."
            className="input w-full max-w-md"
          />
          <SegmentedControl
            value={status}
            onChange={(v) => {
              const next = v as "all" | "active" | "inactive";
              setStatus(next);
              router.replace(next === "all" ? "/clients" : `/clients?status=${next}`);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </div>
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
            className="btn btn-secondary flex gap-1.5 px-3"
          >
            <Download className="h-4 w-4" />
            {selected.size > 0 ? `Export selected (${selected.size})` : "Export CSV"}
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-primary">
          All Clients
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} />
                </th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Code</th>
                {has.contactPerson && <th className="px-4 py-3">Contact Person</th>}
                {has.contactInfo && <th className="px-4 py-3">Contact Info</th>}
                {has.rates && <th className="px-4 py-3">Rates (AED)</th>}
                {has.contract && <th className="px-4 py-3">Contract Period</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {pageRows.map((c) => (
                <tr key={c.id} className={complianceRowClass(c.licenseStatus) || "hover:bg-surface-hover"}>
                  <td className="px-4 py-3">
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium text-primary">
                    <Link href={`/clients/${c.id}`}>{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.code || "—"}</td>
                  {has.contactPerson && (
                    <td className="px-4 py-3 text-secondary">
                      {c.contactPerson || "—"}
                    </td>
                  )}
                  {has.contactInfo && (
                    <td className="px-4 py-3 text-secondary">
                      {c.contactEmail && <div>{c.contactEmail}</div>}
                      {c.contactPhone && (
                        <div className="text-xs text-subtle">{c.contactPhone}</div>
                      )}
                      {!c.contactEmail && !c.contactPhone && "—"}
                    </td>
                  )}
                  {has.rates && (
                    <td className="px-4 py-3 text-secondary">
                      {c.basicRate != null && <div>Basic: AED {c.basicRate}</div>}
                      {c.hourlyRate != null && (
                        <div className="text-xs text-subtle">Hourly: AED {c.hourlyRate}</div>
                      )}
                      {c.basicRate == null && c.hourlyRate == null && "—"}
                    </td>
                  )}
                  {has.contract && (
                    <td className="px-4 py-3 text-muted">
                      {c.contractStart || c.contractEnd
                        ? `${fmtDate(c.contractStart)} – ${fmtDate(c.contractEnd)}`
                        : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Badge color={c.status === "ACTIVE" ? "green" : "slate"}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                    <DeleteButton
                      action={deleteClientAction}
                      hiddenFields={{ clientId: c.id }}
                      confirmMessage={`Delete client "${c.name}"? Clients with projects or timesheet history can't be deleted — you'll be told which.`}
                    />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted">
              {query ? <>No clients match &ldquo;{query}&rdquo;.</> : "No clients match this filter."}
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
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-secondary">
            {selected.size} selected
          </span>
          <DeleteClientsButton ids={[...selected]} onDone={clear} />
          <button
            type="button"
            onClick={clear}
            className="text-xs font-medium text-muted hover:underline"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
