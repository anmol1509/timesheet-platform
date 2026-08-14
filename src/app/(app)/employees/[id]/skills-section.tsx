"use client";

import { useRef, useTransition } from "react";
import { addSkillAction, removeSkillAction } from "./actions";

type SkillRow = {
  id: string;
  name: string;
  proficiencyPercent: number | null;
  rate: number | null;
};

export function SkillsSection({
  employeeId,
  skills,
}: {
  employeeId: string;
  skills: SkillRow[];
}) {
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const proficiencyRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const name = nameRef.current?.value.trim();
    if (!name) return;
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("skillName", name);
    if (proficiencyRef.current?.value) formData.append("proficiencyPercent", proficiencyRef.current.value);
    if (rateRef.current?.value) formData.append("rate", rateRef.current.value);
    startTransition(() => {
      addSkillAction(formData);
    });
    if (nameRef.current) nameRef.current.value = "";
    if (proficiencyRef.current) proficiencyRef.current.value = "";
    if (rateRef.current) rateRef.current.value = "";
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-primary">Known Trade Details</h2>
      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">Trade</span>
            <input
              ref={nameRef}
              placeholder="e.g. Welding, Carpentry"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="input w-full"
            />
          </div>
          <div className="w-24">
            <span className="mb-1 block text-xs font-medium text-muted">% Known</span>
            <input
              ref={proficiencyRef}
              type="number"
              min={0}
              max={100}
              className="input w-full"
            />
          </div>
          <div className="w-28">
            <span className="mb-1 block text-xs font-medium text-muted">Rate (AED)</span>
            <input
              ref={rateRef}
              type="number"
              step="0.01"
              className="input w-full"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="btn btn-primary"
          >
            Add
          </button>
        </div>

        {skills.length === 0 ? (
          <p className="mt-4 text-sm text-subtle">No known trades added yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-default">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-3 py-2">Trade</th>
                  <th className="px-3 py-2 text-right">% Known</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {skills.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-medium text-primary">{s.name}</td>
                    <td className="px-3 py-2 text-right text-secondary">
                      {s.proficiencyPercent != null ? `${s.proficiencyPercent}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">
                      {s.rate != null ? `AED ${s.rate.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <form action={removeSkillAction} className="inline">
                        <input type="hidden" name="employeeId" value={employeeId} />
                        <input type="hidden" name="skillId" value={s.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
