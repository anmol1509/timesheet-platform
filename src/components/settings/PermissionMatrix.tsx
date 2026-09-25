"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { ACTIONS, ACTION_LABELS, MODULES, permissionKey } from "@/lib/permissions";

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
  return (
    <div className="overflow-x-auto rounded-lg border border-default">
      <table className="w-full text-sm">
        <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2.5">Module</th>
            {ACTIONS.map((a) => (
              <th key={a} className="px-2 py-2.5 text-center">{ACTION_LABELS[a]}</th>
            ))}
            {!readOnly && <th className="px-2 py-2.5 text-center">All</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {MODULES.map((m) => {
            const all = m.actions.every((a) => perms.has(permissionKey(m.key, a)));
            const some = m.actions.some((a) => perms.has(permissionKey(m.key, a)));
            return (
              <tr key={m.key} className={readOnly && !some ? "opacity-50" : undefined}>
                <td className="px-3 py-2">
                  <p className="font-medium text-primary">{m.label}</p>
                  {!compact && <p className="text-xs text-muted">{m.description}</p>}
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
                        ariaLabel={`${m.label}: ${ACTION_LABELS[a]}`}
                      />
                    )}
                  </td>
                ))}
                {!readOnly && (
                  <td className="px-2 py-2 text-center">
                    <Checkbox
                      checked={all}
                      indeterminate={some && !all}
                      onCheckedChange={(c) => onChange(toggleModuleRow(perms, m.key, m.actions, c))}
                      ariaLabel={`${m.label}: all`}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
