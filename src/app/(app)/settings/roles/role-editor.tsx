"use client";

import { useActionState, useState } from "react";
import { PermissionMatrix } from "@/components/settings/PermissionMatrix";
import { Select } from "@/components/ui/Select";
import { ROLE_PRESETS } from "@/lib/permissions";
import { saveRoleAction } from "./actions";

type Branch = { id: string; code: string; name: string };
type Role = { id: string; name: string; description: string | null; permissions: string[]; branchId: string | null };

/** Module × action grid. Ticking any action ticks View for that module (an
 * action without View would be unreachable), and unticking View clears the row. */
export function RoleEditor({
  role,
  branches,
  isSuperAdmin,
  onDone,
}: {
  role?: Role;
  branches: Branch[];
  isSuperAdmin: boolean;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: { error: string | null; ok?: boolean }, fd: FormData) => {
      const res = await saveRoleAction(prev, fd);
      if (res.ok) onDone?.();
      return res;
    },
    { error: null } as { error: string | null; ok?: boolean }
  );
  const [perms, setPerms] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");

  function applyPreset(presetName: string) {
    const preset = ROLE_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    setPerms(new Set(preset.permissions));
    if (!name) setName(preset.name);
    if (!description) setDescription(preset.description);
  }

  return (
    <form action={action} className="space-y-4">
      {role && <input type="hidden" name="id" value={role.id} />}
      {[...perms].map((p) => (
        <input key={p} type="hidden" name="permission" value={p} />
      ))}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Role name</span>
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Site supervisor" className="input w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Description (optional)</span>
          <input name="description" value={description} onChange={(e) => setDescription(e.target.value)} className="input w-full" />
        </label>
        {isSuperAdmin && !role && (
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted">Available to</span>
            <Select
              name="branchId"
              defaultValue=""
              searchable={false}
              options={[{ value: "", label: "Every branch" }, ...branches.map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))]}
            />
          </label>
        )}
      </div>

      {!role && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Start from:</span>
          {ROLE_PRESETS.map((p) => (
            <button key={p.name} type="button" className="btn btn-secondary" onClick={() => applyPreset(p.name)} title={p.description}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <PermissionMatrix perms={perms} onChange={setPerms} />
      <p className="text-xs text-muted">
        Administration (settings, team, lookups, audit log, data reset) is never granted through a role — it stays with admins.
      </p>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : role ? "Save changes" : "Create role"}
        </button>
        {state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}
        {state.ok && !onDone && <p role="status" className="text-sm text-[var(--success-text,#067647)]">Saved.</p>}
      </div>
    </form>
  );
}
