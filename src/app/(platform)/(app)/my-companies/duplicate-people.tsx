"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mergePeopleAction } from "./people-actions";

export type DupPerson = { id: string; name: string; where: string; docs: number };

/** Groups of people who look like the same person, each with a one-click merge into the one to keep. */
export function DuplicatePeople({ groups }: { groups: DupPerson[][] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [keep, setKeep] = useState<Record<number, string>>({});

  function merge(gi: number, group: DupPerson[]) {
    const keepId = keep[gi] ?? group[0].id;
    setError(null);
    start(async () => {
      for (const p of group) {
        if (p.id === keepId) continue;
        const res = await mergePeopleAction({ keepId, dropId: p.id });
        if (res.error) return setError(res.error);
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4" aria-label="Possible duplicate people">
      <div>
        <h2 className="text-sm font-semibold text-primary">Possible duplicate people</h2>
        <p className="text-sm text-muted">These owners and sponsors share a name. If they are the same person, merge them: companies, shares and documents move to the one you keep.</p>
      </div>
      {groups.map((g, gi) => (
        <div key={g.map((p) => p.id).join()} className="space-y-2 rounded-xl border border-default bg-surface p-3">
          {g.map((p) => (
            <label key={p.id} className="flex items-start gap-2 text-sm">
              <input type="radio" name={`keep-${gi}`} className="mt-1" checked={(keep[gi] ?? g[0].id) === p.id} onChange={() => setKeep({ ...keep, [gi]: p.id })} />
              <span><span className="font-medium text-primary">{p.name}</span> <span className="text-muted">— {p.where || "no company"} · {p.docs} document{p.docs === 1 ? "" : "s"}</span></span>
            </label>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => merge(gi, g)}>{pending ? "Merging…" : "Merge into the selected person"}</button>
        </div>
      ))}
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
    </section>
  );
}
