"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";
import type { BreakdownClient, ImportBreakdown } from "@/lib/importer/types";

const SHOWN = 3;

/** The file by client: new or existing, which months, and who is in it. Shown before anything is saved. */
export function ImportBreakdownView({ breakdown }: { breakdown: ImportBreakdown }) {
  const [only, setOnly] = useState<"all" | "look">("all");
  const [open, setOpen] = useState<Set<string>>(() => new Set(breakdown.clients.slice(0, 3).map((c) => c.name)));
  const [all, setAll] = useState<Set<string>>(new Set());
  const needsLook = (c: BreakdownClient) => c.isNew || !!c.matchedFrom || c.people.some((p) => p.note);
  const clients = breakdown.clients.filter((c) => only === "all" || needsLook(c));
  const lookCount = breakdown.clients.filter(needsLook).length;
  const toggle = (set: Set<string>, name: string) => { const n = new Set(set); if (n.has(name)) n.delete(name); else n.add(name); return n; };

  return (
    <section className="space-y-3" aria-label="What is in this upload">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-primary">
          In this upload <span className="font-normal text-muted">· {breakdown.clients.length} {breakdown.clients.length === 1 ? "client" : "clients"} · {breakdown.months} {breakdown.months === 1 ? "month" : "months"} · {breakdown.workers} {breakdown.workers === 1 ? "worker" : "workers"}</span>
        </h2>
        {breakdown.clients.length > 1 && (
          <div className="flex gap-1.5">
            {([["all", `All clients (${breakdown.clients.length})`], ["look", `Need a look (${lookCount})`]] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setOnly(key)} className={cn("rounded-control border px-3 py-1.5 text-xs font-medium transition", only === key ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default bg-surface text-secondary hover:bg-surface-hover")}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {clients.map((c) => {
        const isOpen = open.has(c.name);
        const people = all.has(c.name) ? c.people : c.people.slice(0, SHOWN);
        return (
          <div key={c.name} className="card overflow-hidden">
            <button type="button" onClick={() => setOpen((s) => toggle(s, c.name))} aria-expanded={isOpen} className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1 bg-surface-subtle px-4 py-3 text-left">
              {isOpen ? <ChevronDown className="h-4 w-4 text-subtle" aria-hidden /> : <ChevronRight className="h-4 w-4 text-subtle" aria-hidden />}
              <b className="text-sm text-primary">{c.name}</b>
              {c.name !== "No client named" && <Badge color={c.isNew ? "blue" : "green"}>{c.isNew ? "New client" : "Existing"}</Badge>}
              {c.matchedFrom && <Badge color="amber">Matched from “{c.matchedFrom}”</Badge>}
              <span className="text-xs text-muted">{c.workers} {c.workers === 1 ? "worker" : "workers"} · {c.months.map((m) => `${m.label}${c.months.length > 1 ? ` (${m.workers})` : ""}`).join(", ")}</span>
            </button>
            {isOpen && (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[var(--border)]">
                  {people.map((p) => (
                    <tr key={p.idNo}>
                      <td className="py-2 pr-3 pl-11"><b className="text-primary">{p.name}</b> <span className="text-xs text-subtle">{p.idNo}</span></td>
                      <td className="px-3 py-2 text-secondary">{p.trade || "—"}</td>
                      <td className="tabular px-3 py-2 text-secondary">{p.days} days</td>
                      <td className="tabular px-3 py-2 text-secondary">{p.hours} h</td>
                      <td className="px-4 py-2 text-right">{p.note && <Badge color="amber">{p.note}</Badge>}</td>
                    </tr>
                  ))}
                  {!all.has(c.name) && c.people.length > SHOWN && (
                    <tr><td colSpan={5} className="py-2 pl-11"><button type="button" onClick={() => setAll((s) => new Set(s).add(c.name))} className="text-sm font-medium text-[var(--brand-primary)] hover:underline">Show {c.people.length > c.workers ? "the first " : "all "}{c.people.length} workers{c.hiddenPeople > 0 ? ` (${c.hiddenPeople} more not listed)` : ""}</button></td></tr>
                  )}
                  {all.has(c.name) && c.hiddenPeople > 0 && (
                    <tr><td colSpan={5} className="py-2 pl-11 text-xs text-muted">and {c.hiddenPeople} more, not listed here. They are all imported.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
      {clients.length === 0 && <p className="card px-4 py-6 text-center text-sm text-muted">Nothing needs a look.</p>}
    </section>
  );
}
