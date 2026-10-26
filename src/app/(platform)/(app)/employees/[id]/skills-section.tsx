"use client";

import { useRef, useState, useTransition } from "react";
import {
  DEFAULT_SKILL_LEVEL,
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
  SKILL_LEVEL_STEP,
  skillLevelLabel,
} from "@/lib/skillLevel";
import { Slider } from "@/components/ui/Slider";
import { Select } from "@/components/ui/Select";
import { TRADES, RATE_TYPES } from "@/lib/trades";
import { addSkillAction, removeSkillAction } from "./actions";
import { NumberInput } from "@/components/ui/NumberInput";

type SkillRow = {
  id: string;
  name: string;
  proficiencyPercent: number | null;
  rate: number | null;
  rateType?: string | null;
};

export function SkillsSection({
  employeeId,
  skills,
  workerRate = null,
  workerTrade = null,
}: {
  employeeId: string;
  skills: SkillRow[];
  /** The hourly rate saved on the worker (what payroll pays first); null when not set or the viewer may not see pay. */
  workerRate?: number | null;
  workerTrade?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [trade, setTrade] = useState("");
  const [level, setLevel] = useState(DEFAULT_SKILL_LEVEL);
  const [rateType, setRateType] = useState("");
  const rateRef = useRef<HTMLInputElement>(null);
  const [resetKey, setResetKey] = useState(0);
  // The trade being edited: the add form is filled with its values and saves over it (adding an existing trade updates it).
  const [editing, setEditing] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  function startEdit(s: SkillRow) {
    setTrade(s.name);
    setLevel(s.proficiencyPercent ?? DEFAULT_SKILL_LEVEL);
    setRateType(s.rateType ?? "");
    setEditRate(s.rate);
    setEditing(s.name);
    setResetKey((k) => k + 1);
    formRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  function cancelEdit() {
    setEditing(null);
    setEditRate(null);
    setTrade("");
    setLevel(DEFAULT_SKILL_LEVEL);
    setRateType("");
    setResetKey((k) => k + 1);
  }
  // The rate saved on the worker lives in Pay structure below; Edit takes you to that field.
  function editWorkerRate() {
    const input = document.querySelector<HTMLInputElement>('input[name="hourlyRate"]');
    if (!input) return;
    input.scrollIntoView({ block: "center", behavior: "smooth" });
    input.focus();
    input.select();
  }

  function handleAdd() {
    const name = trade.trim();
    if (!name) return;
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("skillName", name);
    formData.append("proficiencyPercent", String(level));
    if (rateRef.current?.value) formData.append("rate", rateRef.current.value);
    if (rateType) formData.append("rateType", rateType);
    startTransition(() => {
      addSkillAction(formData);
    });
    setTrade("");
    setLevel(DEFAULT_SKILL_LEVEL);
    setRateType("");
    setEditing(null);
    setEditRate(null);
    setResetKey((k) => k + 1);
    if (rateRef.current) rateRef.current.value = "";
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-primary">Known Trade Details</h2>
      <div className="card p-5">
        <div ref={formRef} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">Trade</span>
            <Select
              value={trade}
              onChange={setTrade}
              searchable
              placeholder="Select a trade…"
              options={TRADES.map((t) => ({ value: t, label: t }))}
            />
          </div>
          {/* Range and wording match the registration wizard — the two
              screens write the same column. */}
          <Slider
            className="w-44"
            label="Level"
            valueLabel={`${skillLevelLabel(level)} · ${level}%`}
            min={SKILL_LEVEL_MIN}
            max={SKILL_LEVEL_MAX}
            step={SKILL_LEVEL_STEP}
            value={level}
            onChange={setLevel}
            ariaLabel="Trade level"
          />
          <div className="w-36">
            <span className="mb-1 block text-xs font-medium text-muted">Rate type</span>
            <Select value={rateType} onChange={setRateType} searchable={false} placeholder="Hourly or fixed" options={RATE_TYPES.map((r) => ({ value: r.value, label: r.label }))} />
          </div>
          <div className="w-28">
            <span className="mb-1 block text-xs font-medium text-muted">Rate (AED)</span>
            <NumberInput key={resetKey} step={0.01} inputRef={rateRef} defaultValue={editRate ?? ""} className="w-full" />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="btn btn-primary"
          >
            {editing ? "Save changes" : "Add"}
          </button>
          {editing && (
            <button type="button" onClick={cancelEdit} className="btn btn-secondary">
              Cancel
            </button>
          )}
        </div>

        {skills.length === 0 && !(workerRate != null && workerRate > 0) ? (
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
                {workerRate != null && workerRate > 0 && (
                  <tr className="bg-brand-soft/40">
                    <td className="px-3 py-2 font-medium text-primary">
                      {workerTrade ?? "Trade"}
                      <span className="ml-2 rounded-full border border-default px-1.5 py-0.5 text-[10px] font-medium text-muted" title="Saved on this worker under Pay structure. Payroll pays this before any trade rate below.">Paid by payroll</span>
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">{DEFAULT_SKILL_LEVEL}%</td>
                    <td className="px-3 py-2 text-right text-secondary">AED {workerRate.toFixed(2)} / hour</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={editWorkerRate} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Edit</button>
                    </td>
                  </tr>
                )}
                {skills.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-medium text-primary">{s.name}</td>
                    <td className="px-3 py-2 text-right text-secondary">
                      {s.proficiencyPercent ?? DEFAULT_SKILL_LEVEL}%
                      <span className="ml-1.5 text-xs text-subtle">
                        {skillLevelLabel(s.proficiencyPercent ?? DEFAULT_SKILL_LEVEL)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">
                      {s.rate != null ? `AED ${s.rate.toFixed(2)}${s.rateType === "FIXED" ? " / month" : s.rateType === "HOURLY" ? " / hour" : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => startEdit(s)} className="mr-3 text-xs font-medium text-[var(--brand-primary)] hover:underline">Edit</button>
                      <form action={removeSkillAction} className="inline">
                        <input type="hidden" name="employeeId" value={employeeId} />
                        <input type="hidden" name="skillId" value={s.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-[var(--error)] hover:underline"
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
        {workerRate != null && workerRate > 0 && skills.some((k) => (k.rate ?? 0) > 0) && (
          <p className="mt-2 text-xs text-muted">Payroll pays the rate marked “Paid by payroll”; the rates on the other trades are used only when that one is empty.</p>
        )}
      </div>
    </section>
  );
}
