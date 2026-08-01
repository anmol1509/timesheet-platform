"use client";

import { useRef, useTransition } from "react";
import { addSkillAction, removeSkillAction } from "./actions";

export function SkillsSection({
  employeeId,
  skills,
}: {
  employeeId: string;
  skills: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const name = inputRef.current?.value.trim();
    if (!name) return;
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("skillName", name);
    startTransition(() => {
      addSkillAction(formData);
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Skills</h2>
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            placeholder="Add a skill (e.g., Welding, Carpentry, etc.)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            +
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {skills.length === 0 && (
            <p className="text-sm text-slate-400">No skills added yet.</p>
          )}
          {skills.map((s) => (
            <form key={s.id} action={removeSkillAction}>
              <input type="hidden" name="employeeId" value={employeeId} />
              <input type="hidden" name="skillId" value={s.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                {s.name}
                <span className="text-slate-400">×</span>
              </button>
            </form>
          ))}
        </div>
      </div>
    </section>
  );
}
