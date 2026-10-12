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
import { TRADES } from "@/lib/trades";
import { addSkillAction, removeSkillAction } from "./actions";
import { NumberInput } from "@/components/ui/NumberInput";

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
  const [trade, setTrade] = useState("");
  const [level, setLevel] = useState(DEFAULT_SKILL_LEVEL);
  const rateRef = useRef<HTMLInputElement>(null);
  const [resetKey, setResetKey] = useState(0);

  function handleAdd() {
    const name = trade.trim();
    if (!name) return;
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("skillName", name);
    formData.append("proficiencyPercent", String(level));
    if (rateRef.current?.value) formData.append("rate", rateRef.current.value);
    startTransition(() => {
      addSkillAction(formData);
    });
    setTrade("");
    setLevel(DEFAULT_SKILL_LEVEL);
    setResetKey((k) => k + 1);
    if (rateRef.current) rateRef.current.value = "";
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-primary">Known Trade Details</h2>
      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-2">
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
          <div className="w-28">
            <span className="mb-1 block text-xs font-medium text-muted">Rate (AED)</span>
            <NumberInput key={resetKey} step={0.01} inputRef={rateRef} className="w-full" />
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
                      {s.proficiencyPercent != null ? (
                        <>
                          {s.proficiencyPercent}%
                          <span className="ml-1.5 text-xs text-subtle">
                            {skillLevelLabel(s.proficiencyPercent)}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
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
      </div>
    </section>
  );
}
