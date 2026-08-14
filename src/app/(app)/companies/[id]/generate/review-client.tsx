"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DailyHourCell } from "@/lib/parseTimesheet";
import { calculateAbsentDeduction, calculateGasDeduction } from "@/lib/deductions";

type Entry = {
  id: string;
  employeeIdNo: string;
  employeeName: string;
  trade: string;
  rate: number;
  totalHours: number;
  absentCount: number;
  absentDeduction: number;
  dailyHours: DailyHourCell[];
  clientName: string | null;
};

export function ReviewClient({
  supplier,
  month,
  monthLabel,
  issuedTo: initialIssuedTo,
  entries,
}: {
  supplier: { id: string; name: string; fullName: string | null };
  month: string;
  monthLabel: string;
  issuedTo: string;
  entries: Entry[];
}) {
  const [fullName, setFullName] = useState(supplier.fullName || supplier.name);
  const [issuedTo, setIssuedTo] = useState(initialIssuedTo);

  const defaultAbsentDeductions = useMemo(
    () =>
      Object.fromEntries(
        entries.map((e) => [e.id, calculateAbsentDeduction(e.absentCount)])
      ),
    [entries]
  );
  const defaultGasDeductions = useMemo(
    () =>
      Object.fromEntries(
        entries.map((e) => [e.id, calculateGasDeduction(e.dailyHours)])
      ),
    [entries]
  );

  const [deductions, setDeductions] = useState<Record<string, number>>(() =>
    Object.fromEntries(entries.map((e) => [e.id, e.absentDeduction]))
  );
  const [gasDeductions, setGasDeductions] = useState<Record<string, number>>(
    () => ({ ...defaultGasDeductions })
  );
  const [generating, setGenerating] = useState<"xlsx" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetRow(id: string) {
    setDeductions((d) => ({ ...d, [id]: defaultAbsentDeductions[id] }));
    setGasDeductions((d) => ({ ...d, [id]: defaultGasDeductions[id] }));
  }

  function resetAll() {
    setDeductions({ ...defaultAbsentDeductions });
    setGasDeductions({ ...defaultGasDeductions });
  }

  const anyEdited = entries.some(
    (e) =>
      deductions[e.id] !== defaultAbsentDeductions[e.id] ||
      gasDeductions[e.id] !== defaultGasDeductions[e.id]
  );

  const tradeSummary = useMemo(() => {
    const map = new Map<
      string,
      { trade: string; rate: number; hours: number; amount: number }
    >();
    for (const e of entries) {
      const key = `${e.trade}__${e.rate}`;
      const existing = map.get(key);
      if (existing) {
        existing.hours += e.totalHours;
        existing.amount += e.totalHours * e.rate;
      } else {
        map.set(key, {
          trade: e.trade,
          rate: e.rate,
          hours: e.totalHours,
          amount: e.totalHours * e.rate,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.trade.localeCompare(b.trade));
  }, [entries]);

  const totalAmount = tradeSummary.reduce((s, r) => s + r.amount, 0);
  const totalAbsentDeduction = Object.values(deductions).reduce(
    (s, v) => s + (v || 0),
    0
  );
  const totalGasDeduction = Object.values(gasDeductions).reduce(
    (s, v) => s + (v || 0),
    0
  );
  const totalDeduction = totalAbsentDeduction + totalGasDeduction;
  const netPayable = totalAmount - totalDeduction;

  async function handleDownload(format: "xlsx" | "pdf") {
    setGenerating(format);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          month,
          format,
          fullName,
          issuedTo,
          gasDeductions,
          deductions,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate file.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `${supplier.name}-${month}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate file.");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/companies" className="text-sm text-muted hover:underline">
          ← Companies
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl tracking-tight text-primary font-semibold">
              {supplier.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {monthLabel} · {entries.length} employees
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload("xlsx")}
              disabled={generating !== null}
              className="btn btn-secondary"
            >
              {generating === "xlsx" ? "Generating…" : "Download XLSX"}
            </button>
            <button
              onClick={() => handleDownload("pdf")}
              disabled={generating !== null}
              className="btn btn-primary"
            >
              {generating === "pdf" ? "Generating…" : "Download PDF"}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Letterhead name (as it appears on the document)">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input w-full"
          />
        </Field>
        <Field label="Issued to">
          <input
            value={issuedTo}
            onChange={(e) => setIssuedTo(e.target.value)}
            className="input w-full"
          />
        </Field>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Employees</h2>
          {anyEdited && (
            <button
              type="button"
              onClick={resetAll}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Reset all to calculated
            </button>
          )}
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">ID No</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-right">Absent</th>
                <th className="px-4 py-3 text-right">Absent deduction</th>
                <th className="px-4 py-3 text-right">Gas deduction</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {entries.map((e) => {
                const absentEdited =
                  deductions[e.id] !== defaultAbsentDeductions[e.id];
                const gasEdited = gasDeductions[e.id] !== defaultGasDeductions[e.id];
                const rowEdited = absentEdited || gasEdited;
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-2.5 text-muted">{e.employeeIdNo}</td>
                    <td className="px-4 py-2.5 font-medium text-primary">
                      {e.employeeName}
                      {e.clientName && (
                        <span className="ml-2 text-xs font-normal text-subtle">
                          {e.clientName}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-secondary">{e.trade}</td>
                    <td className="px-4 py-2.5 text-right text-secondary">
                      {e.rate.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-secondary">
                      {e.totalHours}
                    </td>
                    <td className="px-4 py-2.5 text-right text-secondary">
                      {e.absentCount}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        {absentEdited && (
                          <span
                            title="Overridden from calculated value"
                            className="h-1.5 w-1.5 rounded-full bg-amber-500"
                          />
                        )}
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={deductions[e.id]}
                          onChange={(ev) =>
                            setDeductions((d) => ({
                              ...d,
                              [e.id]: parseFloat(ev.target.value) || 0,
                            }))
                          }
                          className={`w-24 rounded-lg border px-2 py-1 text-right text-sm outline-none focus:border-[var(--brand-primary)] ${
                            absentEdited ? "border-amber-300 bg-amber-50" : "border-strong"
                          }`}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        {gasEdited && (
                          <span
                            title="Overridden from calculated value"
                            className="h-1.5 w-1.5 rounded-full bg-amber-500"
                          />
                        )}
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={gasDeductions[e.id]}
                          onChange={(ev) =>
                            setGasDeductions((d) => ({
                              ...d,
                              [e.id]: parseFloat(ev.target.value) || 0,
                            }))
                          }
                          className={`w-24 rounded-lg border px-2 py-1 text-right text-sm outline-none focus:border-[var(--brand-primary)] ${
                            gasEdited ? "border-amber-300 bg-amber-50" : "border-strong"
                          }`}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {rowEdited && (
                        <button
                          type="button"
                          onClick={() => resetRow(e.id)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-primary">
            Trade summary
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Trade</th>
                  <th className="px-4 py-3 text-right">Hours</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {tradeSummary.map((row) => (
                  <tr key={`${row.trade}-${row.rate}`}>
                    <td className="px-4 py-2.5 text-primary">{row.trade}</td>
                    <td className="px-4 py-2.5 text-right text-secondary">
                      {row.hours}
                    </td>
                    <td className="px-4 py-2.5 text-right text-secondary">
                      {row.rate.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-primary">
                      {row.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-primary">
            Payment summary
          </h2>
          <div className="card space-y-3 p-5">
            <SummaryRow label="Total amount" value={totalAmount} />
            <SummaryRow label="Absent deduction" value={totalAbsentDeduction} />
            <SummaryRow label="Gas deduction" value={totalGasDeduction} />
            <SummaryRow label="Total deduction" value={totalDeduction} />
            <div className="border-t border-default pt-3">
              <SummaryRow
                label="Net amount payable (AED)"
                value={netPayable}
                bold
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={bold ? "font-semibold text-primary" : "text-muted"}>
        {label}
      </span>
      <span className={bold ? "text-lg font-semibold text-primary" : "text-secondary"}>
        {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
