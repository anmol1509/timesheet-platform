"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { TrendingUp } from "lucide-react";
import { toggleTrendingAction, deleteSkillAction } from "./actions";

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
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Skills Overview ({filtered.length} skills)
        </h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Skill Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Employee Count</th>
                <th className="px-4 py-3">Popularity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => {
                const demand = demandLevel(s.popularity);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
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
                                : "bg-slate-50 text-slate-300 hover:text-slate-500"
                            }`}
                            title="Toggle trending"
                          >
                            <TrendingUp className="h-3 w-3" /> Trending
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.category ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                          {s.category}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {s.employeeCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#0B1642]"
                            style={{ width: `${Math.min(100, s.popularity)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
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
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No skills match.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
