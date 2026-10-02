"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { ACTIONS, ACTION_LABELS, MODULES, pageKey, permissionKey } from "@/lib/permissions";

/** Ticking any action ticks View for that module (an action without View is unreachable); unticking View clears the row. */
export function togglePermission(prev: Set<string>, module: string, act: string, on: boolean) {
  const next = new Set(prev);
  const key = permissionKey(module, act as never);
  if (on) {
    next.add(key);
    if (act !== "view") next.add(permissionKey(module, "view"));
  } else {
    next.delete(key);
    if (act === "view") for (const a of ACTIONS) next.delete(permissionKey(module, a));
  }
  return next;
}

export function toggleModuleRow(prev: Set<string>, module: string, actions: readonly string[], on: boolean) {
  const next = new Set(prev);
  for (const a of actions) {
    const key = permissionKey(module, a as never);
    if (on) next.add(key);
    else next.delete(key);
  }
  // A module-wide grant already covers every page, so the page-level ticks under it are dropped.
  if (on) {
    const m = MODULES.find((x) => x.key === module);
    for (const p of m?.pages ?? []) for (const a of ACTIONS) next.delete(permissionKey(pageKey(module, p.key), a));
  }
  return next;
}

/** Module × action grid. Read-only when `onChange` is omitted. */
export function PermissionMatrix({
  perms,
  onChange,
  compact,
}: {
  perms: Set<string>;
  onChange?: (next: Set<string>) => void;
  compact?: boolean;
}) {
  const readOnly = !onChange;
  const [open, setOpen] = useState<Set<string>>(() => new Set(MODULES.filter((m) => !m.actions.some((a) => perms.has(permissionKey(m.key, a))) && m.pages.some((p) => perms.has(permissionKey(pageKey(m.key, p.key), "view")))).map((m) => m.key)));
  return (
    <div className="overflow-x-auto rounded-lg border border-default">
      <table className="w-full text-sm">
        <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2.5">Module / page</th>
            {ACTIONS.map((a) => (
              <th key={a} className="px-2 py-2.5 text-center">{ACTION_LABELS[a]}</th>
            ))}
            {!readOnly && <th className="px-2 py-2.5 text-center">All</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {MODULES.map((m) => {
            const all = m.actions.every((a) => perms.has(permissionKey(m.key, a)));
            const wholeSome = m.actions.some((a) => perms.has(permissionKey(m.key, a)));
            const pagesWithAccess = m.pages.filter((p) => perms.has(permissionKey(pageKey(m.key, p.key), "view"))).length;
            const some = wholeSome || pagesWithAccess > 0;
            const isOpen = open.has(m.key);
            return (
              <Fragment key={m.key}>
                <tr className={readOnly && !some ? "opacity-50" : undefined}>
                  <td className="px-3 py-2">
                    <button type="button" className="flex w-full items-start gap-1.5 text-left" onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(m.key)) n.delete(m.key); else n.add(m.key); return n; })} aria-expanded={isOpen} aria-label={`${m.label}: ${isOpen ? "hide" : "show"} pages`}>
                      <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 text-subtle transition ${isOpen ? "rotate-90" : ""}`} aria-hidden />
                      <span>
                        <span className="font-medium text-primary">{m.label}</span>
                        {!wholeSome && pagesWithAccess > 0 && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-[var(--brand-primary)]">{pagesWithAccess} of {m.pages.length} pages</span>}
                        {!compact && <span className="block text-xs text-muted">{m.description}</span>}
                      </span>
                    </button>
                  </td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="px-2 py-2 text-center">
                      {!m.actions.includes(a) ? (
                        <span className="text-subtle" aria-hidden>—</span>
                      ) : readOnly ? (
                        perms.has(permissionKey(m.key, a)) ? (
                          <span className="text-[var(--success)]" aria-label="Allowed">✓</span>
                        ) : (
                          <span className="text-subtle" aria-label="Not allowed">·</span>
                        )
                      ) : (
                        <Checkbox
                          checked={perms.has(permissionKey(m.key, a))}
                          onCheckedChange={(c) => onChange(togglePermission(perms, m.key, a, c))}
                          ariaLabel={`${m.label}: ${ACTION_LABELS[a]} (whole module)`}
                        />
                      )}
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="px-2 py-2 text-center">
                      <Checkbox
                        checked={all}
                        indeterminate={wholeSome && !all}
                        onCheckedChange={(c) => onChange(toggleModuleRow(perms, m.key, m.actions, c))}
                        ariaLabel={`${m.label}: all (whole module)`}
                      />
                    </td>
                  )}
                </tr>
                {isOpen && m.pages.map((p) => {
                  const target = pageKey(m.key, p.key);
                  const pageAll = m.actions.every((a) => perms.has(permissionKey(m.key, a)) || perms.has(permissionKey(target, a)));
                  const pageSome = m.actions.some((a) => perms.has(permissionKey(target, a)));
                  return (
                    <tr key={target} className="bg-surface-subtle/60">
                      <td className="py-1.5 pl-10 pr-3 text-secondary">{p.label}</td>
                      {ACTIONS.map((a) => {
                        const inherited = perms.has(permissionKey(m.key, a));
                        const own = perms.has(permissionKey(target, a));
                        return (
                          <td key={a} className="px-2 py-1.5 text-center">
                            {!m.actions.includes(a) ? (
                              <span className="text-subtle" aria-hidden>—</span>
                            ) : readOnly ? (
                              inherited || own ? <span className="text-[var(--success)]" aria-label="Allowed">✓</span> : <span className="text-subtle" aria-label="Not allowed">·</span>
                            ) : (
                              <Checkbox
                                checked={inherited || own}
                                disabled={inherited}
                                onCheckedChange={(c) => onChange(togglePermission(perms, target, a, c))}
                                ariaLabel={`${m.label} › ${p.label}: ${ACTION_LABELS[a]}${inherited ? " (covered by the module row)" : ""}`}
                              />
                            )}
                          </td>
                        );
                      })}
                      {!readOnly && (
                        <td className="px-2 py-1.5 text-center">
                          <Checkbox
                            checked={pageAll}
                            indeterminate={pageSome && !pageAll}
                            disabled={wholeSome && m.actions.every((a) => perms.has(permissionKey(m.key, a)))}
                            onCheckedChange={(c) => onChange(toggleModuleRow(perms, target, m.actions, c))}
                            ariaLabel={`${m.label} › ${p.label}: all`}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
