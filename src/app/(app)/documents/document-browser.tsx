"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/Badge";
import {
  deleteDocumentAction,
  uploadDocumentAction,
} from "@/app/(app)/employees/[id]/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/RadioGroup";

type DocRow = {
  id: string;
  filename: string;
  type: string;
  employeeId: string;
  employeeName: string;
  employeeIdNo: string;
  uploadedByName: string;
  uploadedAt: string;
  expiryDate: string | null;
  status: "valid" | "expiring" | "expired" | "not_set";
};

type EmployeeOption = { id: string; name: string; employeeIdNo: string };

const STATUS_BADGE = {
  valid: { label: "Valid", color: "green" as const },
  expiring: { label: "Expiring soon", color: "amber" as const },
  expired: { label: "Expired", color: "red" as const },
  not_set: { label: "No expiry", color: "slate" as const },
};

const DOC_TYPES = ["PASSPORT", "VISA", "LABOR_CARD", "MEDICAL", "EMIRATES_ID", "OTHER"];

export function DocumentBrowser({
  documents,
  employees,
}: {
  documents: DocRow[];
  employees: EmployeeOption[];
}) {
  const searchParams = useSearchParams();
  const initialEmployeeId = searchParams.get("employee");
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<"all" | "valid" | "expiring">(
    initialTab === "valid" || initialTab === "expiring" ? initialTab : "all"
  );
  const [query, setQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(initialEmployeeId);

  const filteredEmployee = employees.find((e) => e.id === employeeFilter) || null;

  const filtered = useMemo(() => {
    let rows = documents;
    if (employeeFilter) rows = rows.filter((d) => d.employeeId === employeeFilter);
    if (tab === "valid") rows = rows.filter((d) => d.status === "valid");
    if (tab === "expiring")
      rows = rows.filter((d) => d.status === "expiring" || d.status === "expired");
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (d) =>
          d.filename.toLowerCase().includes(q) ||
          d.type.toLowerCase().includes(q) ||
          d.employeeName.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [documents, tab, query, employeeFilter]);

  const validCount = documents.filter((d) => d.status === "valid").length;
  const expiringCount = documents.filter(
    (d) => d.status === "expiring" || d.status === "expired"
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents by name, type, or employee..."
            className="input w-full max-w-sm"
          />
          {filteredEmployee && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-medium text-secondary">
              {filteredEmployee.name}
              <button
                type="button"
                onClick={() => setEmployeeFilter(null)}
                className="text-subtle hover:text-secondary"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowUpload((v) => !v)}
          className="btn btn-primary"
        >
          {showUpload ? "Cancel" : "Upload Document"}
        </button>
      </div>

      {showUpload && (
        <UploadForm employees={employees} onDone={() => setShowUpload(false)} />
      )}

      <SegmentedControl
        value={tab}
        onChange={(v) => setTab(v as "all" | "valid" | "expiring")}
        options={[
          { value: "all", label: `All (${documents.length})` },
          { value: "valid", label: `Valid (${validCount})` },
          { value: "expiring", label: `Expiring (${expiringCount})` },
        ]}
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Upload date</th>
              <th className="px-4 py-3">Expiry status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filtered.map((d) => {
              const badge = STATUS_BADGE[d.status];
              return (
                <tr key={d.id}>
                  <td className="px-4 py-3 text-primary">
                    <a href={`/api/documents/${d.id}`} className="hover:underline">
                      {d.filename}
                    </a>
                    <p className="text-xs text-subtle">by {d.uploadedByName}</p>
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    {d.type.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    <Link
                      href={`/employees/${d.employeeId}`}
                      className="hover:underline"
                    >
                      {d.employeeName}
                    </Link>
                    <span className="ml-1 text-xs text-subtle">
                      {d.employeeIdNo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(d.uploadedAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={badge.color}>{badge.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <a
                      href={`/api/documents/${d.id}`}
                      className="mr-3 text-xs font-medium text-blue-600 hover:underline"
                    >
                      Download
                    </a>
                    <DeleteButton
                      action={deleteDocumentAction}
                      hiddenFields={{ documentId: d.id, employeeId: d.employeeId }}
                      confirmMessage={`Delete "${d.filename}" from ${d.employeeName}'s file? The file itself is removed and can't be recovered.`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            No documents match.
          </p>
        )}
      </div>
    </div>
  );
}

function UploadForm({
  employees,
  onDone,
}: {
  employees: EmployeeOption[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState("PASSPORT");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !employeeId) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`"${file.name}" is too large — max ${MAX_UPLOAD_LABEL}.`);
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("type", type);
    formData.append("expiryDate", expiryDate);
    formData.append("file", file);
    startTransition(async () => {
      await uploadDocumentAction(formData);
      onDone();
    });
  }

  if (employees.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        No employees on record yet —{" "}
        <Link href="/employees/new" className="underline">
          add one
        </Link>{" "}
        before uploading documents.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card flex flex-wrap items-end gap-3 p-4"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">
          Employee
        </span>
        <Select
          value={employeeId}
          onChange={setEmployeeId}
          placeholder="Type a name or ID…"
          triggerClassName="w-64"
          options={employees.map((e) => ({
            value: e.id,
            label: `${e.name} (${e.employeeIdNo})`,
          }))}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Type</span>
        <Select
          value={type}
          onChange={setType}
          searchable={false}
          options={DOC_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">
          Expiry date (optional)
        </span>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="input"
        />
      </label>
      <input
        ref={fileRef}
        type="file"
        required
        className="file-input"
      />
      <button
        type="submit"
        disabled={pending || !employeeId}
        className="btn btn-primary"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
