"use client";

import { useRef, useTransition } from "react";
import { addVaccinationAction, removeVaccinationAction } from "./actions";

type VaccinationRow = {
  id: string;
  vaccineName: string;
  doseNumber: number | null;
  date: Date | null;
  expiryDate: Date | null;
};

function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

export function VaccinationsSection({
  employeeId,
  vaccinations,
}: {
  employeeId: string;
  vaccinations: VaccinationRow[];
}) {
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const doseRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const vaccineName = nameRef.current?.value.trim();
    if (!vaccineName) return;
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("vaccineName", vaccineName);
    if (doseRef.current?.value) formData.append("doseNumber", doseRef.current.value);
    if (dateRef.current?.value) formData.append("date", dateRef.current.value);
    startTransition(() => {
      addVaccinationAction(formData);
    });
    if (nameRef.current) nameRef.current.value = "";
    if (doseRef.current) doseRef.current.value = "";
    if (dateRef.current) dateRef.current.value = "";
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Vaccinations</h2>
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Vaccine</span>
            <input
              ref={nameRef}
              placeholder="e.g. COVID-19"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
          <div className="w-20">
            <span className="mb-1 block text-xs font-medium text-slate-500">Dose #</span>
            <input
              ref={doseRef}
              type="number"
              min={1}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
          <div className="w-40">
            <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
            <input
              ref={dateRef}
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
          >
            Add
          </button>
        </div>

        {vaccinations.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No vaccination records yet.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {vaccinations.map((v) => (
              <form key={v.id} action={removeVaccinationAction}>
                <input type="hidden" name="employeeId" value={employeeId} />
                <input type="hidden" name="vaccinationId" value={v.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  {v.vaccineName}
                  {v.doseNumber ? ` · dose ${v.doseNumber}` : ""} · {formatDate(v.date)}
                  <span className="text-slate-400">×</span>
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
