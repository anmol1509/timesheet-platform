"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/Badge";
import { uploadDocumentAction } from "@/app/(app)/employees/[id]/actions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";

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
  const [tab, setTab] = useState<"all" | "valid" | "expiring">("all");
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
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
          {filteredEmployee && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
              {filteredEmployee.name}
              <button
                type="button"
                onClick={() => setEmployeeFilter(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowUpload((v) => !v)}
          className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90"
        >
          {showUpload ? "Cancel" : "Upload Document"}
        </button>
      </div>

      {showUpload && (
        <UploadForm employees={employees} onDone={() => setShowUpload(false)} />
      )}

      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          All ({documents.length})
        </TabButton>
        <TabButton active={tab === "valid"} onClick={() => setTab("valid")}>
          Valid ({validCount})
        </TabButton>
        <TabButton active={tab === "expiring"} onClick={() => setTab("expiring")}>
          Expiring ({expiringCount})
        </TabButton>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Upload date</th>
              <th className="px-4 py-3">Expiry status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((d) => {
              const badge = STATUS_BADGE[d.status];
              return (
                <tr key={d.id}>
                  <td className="px-4 py-3 text-slate-900">
                    <a href={`/api/documents/${d.id}`} className="hover:underline">
                      {d.filename}
                    </a>
                    <p className="text-xs text-slate-400">by {d.uploadedByName}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {d.type.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <Link
                      href={`/employees/${d.employeeId}`}
                      className="hover:underline"
                    >
                      {d.employeeName}
                    </Link>
                    <span className="ml-1 text-xs text-slate-400">
                      {d.employeeIdNo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(d.uploadedAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={badge.color}>{badge.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/documents/${d.id}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            No documents match.
          </p>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-medium transition ${
        active ? "bg-[#0B1642] text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
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
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [type, setType] = useState("PASSPORT");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedEmployee = employees.find((e) => e.id === employeeId) || null;

  const suggestions = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return [];
    return employees
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) || e.employeeIdNo.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [employees, employeeQuery]);

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
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="relative">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Employee
          </span>
          <input
            value={selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.employeeIdNo})` : employeeQuery}
            onChange={(e) => {
              setEmployeeId("");
              setEmployeeQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Type a name or ID…"
            className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        {showSuggestions && suggestions.length > 0 && !employeeId && (
          <div className="absolute top-full left-0 z-10 mt-1 max-h-56 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {suggestions.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  setEmployeeId(e.id);
                  setEmployeeQuery("");
                  setShowSuggestions(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{e.name}</span>{" "}
                <span className="text-slate-400">{e.employeeIdNo}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Type</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        >
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          Expiry date (optional)
        </span>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
      </label>
      <input ref={fileRef} type="file" required className="text-sm" />
      <button
        type="submit"
        disabled={pending || !employeeId}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
