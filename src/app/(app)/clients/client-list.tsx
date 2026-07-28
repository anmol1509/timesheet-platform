"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/Badge";

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
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ClientList({ clients }: { clients: ClientRow[] }) {
  const [query, setQuery] = useState("");

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

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clients by company name, code, or contact person..."
        className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          All Clients
        </h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Contact Person</th>
                <th className="px-4 py-3">Contact Info</th>
                <th className="px-4 py-3">Rates (AED)</th>
                <th className="px-4 py-3">Contract Period</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
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
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No clients match &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
