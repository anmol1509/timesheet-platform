"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { TrendingUp } from "lucide-react";
import { toggleTrendingAction, deleteSkillAction, updateSkillAction } from "./actions";
import { Select } from "@/components/ui/Select";

type SkillRow = {
  id: string;
  name: string;
  category: string | null;
  trending: boolean;
  employeeCount: number;
  popularity: number;
};

function demandLevel(pct: number): { label: string; color: "green" | "amber" | "slate" } {
  if (pct >= 15) return { label: "High Demand", color: "green" };
  if (pct >= 5) return { label: "Moderate", color: "amber" };
  return { label: "Low Demand", color: "slate" };
}

export function SkillTable({ skills }: { skills: SkillRow[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [pending, startTransition] = useTransition();

  function startEdit(s: SkillRow) {
    setEditingId(s.id);
    setDraftName(s.name);
    setDraftCategory(s.category || "");
  }

  function saveEdit() {
    if (!editingId) return;
    const formData = new FormData();
    formData.set("skillId", editingId);
    formData.set("name", draftName);
    formData.set("category", draftCategory);
    startTransition(async () => {
      await updateSkillAction(formData);
      setEditingId(null);
    });
  }

  const categories = useMemo(() => {
    const set = new Set(skills.map((s) => s.category).filter(Boolean) as string[]);
    return ["All Categories", ...Array.from(set).sort()];
  }, [skills]);

  const filtered = useMemo(() => {
    let rows = skills;
    if (category !== "All Categories") {
      rows = rows.filter((s) => s.category === category);
    }
    const q = query.trim().toLowerCase();
    if (q) rows = rows.filter((s) => s.name.toLowerCase().includes(q));
    return rows;
  }, [skills, query, category]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills..."
          className="input w-full max-w-sm"
        />
        <Select
          value={category}
          onChange={setCategory}
          triggerClassName="w-56"
          options={categories.map((c) => ({ value: c, label: c }))}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-primary">
          Skills Overview ({filtered.length} skills)
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Skill Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Employee Count</th>
                <th className="px-4 py-3">Popularity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((s) => {
                const demand = demandLevel(s.popularity);
                return (
                  <tr key={s.id}>
                    {editingId === s.id ? (
                      <>
                        <td className="px-4 py-3" colSpan={2}>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              value={draftName}
                              onChange={(e) => setDraftName(e.target.value)}
                              autoFocus
                              className="input px-2 py-1"
                            />
                            <input
                              value={draftCategory}
                              onChange={(e) => setDraftCategory(e.target.value)}
                              placeholder="Category"
                              className="input px-2 py-1"
                            />
                            <button
                              type="button"
                              disabled={pending}
                              onClick={saveEdit}
                              className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
                            >
                              {pending ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-xs font-medium text-subtle hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-primary">
                          <div className="flex items-center gap-2">
                            {s.name}
                            <form action={toggleTrendingAction}>
                              <input type="hidden" name="skillId" value={s.id} />
                              <input
                                type="hidden"
                                name="trending"
                                value={String(s.trending)}
                              />
                              <button
                                type="submit"
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  s.trending
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-surface-subtle text-subtle hover:text-muted"
                                }`}
                                title="Toggle trending"
                              >
                                <TrendingUp className="h-3 w-3" /> Trending
                              </button>
                            </form>
                            <button
                              type="button"
                              onClick={() => startEdit(s)}
                              className="text-xs font-medium text-subtle hover:text-secondary hover:underline"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-secondary">
                          {s.category ? (
                            <span className="rounded-full bg-surface-sunken px-2 py-1 text-xs">
                              {s.category}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right text-secondary">
                      {s.employeeCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken">
                          <div
                            className="h-full rounded-full bg-[var(--brand-primary)]"
                            style={{ width: `${Math.min(100, s.popularity)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted">
                          {s.popularity.toFixed(0)}% of workforce
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={demand.color}>{demand.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteButton
                        action={deleteSkillAction}
                        hiddenFields={{ skillId: s.id }}
                        confirmMessage={`Delete the "${s.name}" skill? It will be removed from ${s.employeeCount} employee(s).`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted">
              No skills match.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
