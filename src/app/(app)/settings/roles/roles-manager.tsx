"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { DeleteButton } from "@/components/DeleteButton";
import { MODULES, permissionKey } from "@/lib/permissions";
import { RoleEditor } from "./role-editor";
import { deleteRoleAction } from "./actions";

type Branch = { id: string; code: string; name: string };
type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  branchId: string | null;
  branchLabel: string;
  userCount: number;
  editable: boolean;
};

export function RolesManager({ roles, branches, isSuperAdmin }: { roles: Role[]; branches: Branch[]; isSuperAdmin: boolean }) {
  const [editing, setEditing] = useState<Role | "new" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden /> New role
        </button>
      </div>

      {roles.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          No roles yet. Create one (start from a preset like &ldquo;Site supervisor&rdquo;), then assign it to a team member.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((r) => {
            const viewable = MODULES.filter((m) => r.permissions.includes(permissionKey(m.key, "view")));
            return (
              <article key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-primary">{r.name}</h3>
                    <p className="text-xs text-muted">
                      {r.branchLabel} · {r.userCount} {r.userCount === 1 ? "person" : "people"}
                    </p>
                  </div>
                  {r.editable && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-secondary" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      {r.userCount === 0 && (
                        <DeleteButton
                          action={deleteRoleAction}
                          hiddenFields={{ id: r.id }}
                          confirmMessage={`Delete the role "${r.name}"?`}
                          label="Delete"
                        />
                      )}
                    </div>
                  )}
                </div>
                {r.description && <p className="mt-2 text-xs text-secondary">{r.description}</p>}
                <ul className="mt-3 space-y-1 text-xs">
                  {viewable.map((m) => (
                    <li key={m.key} className="flex flex-wrap gap-x-2">
                      <span className="font-medium text-primary">{m.label}</span>
                      <span className="text-muted">
                        {m.actions.filter((a) => r.permissions.includes(permissionKey(m.key, a))).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && (
          <DialogContent
            className="max-w-3xl!"
            title={editing === "new" ? "New role" : `Edit ${editing.name}`}
            description="Choose which modules this role can open and what it can do in each."
          >
            <div className="mt-4">
              <RoleEditor
                key={editing === "new" ? "new" : editing.id}
                role={editing === "new" ? undefined : editing}
                branches={branches}
                isSuperAdmin={isSuperAdmin}
                onDone={() => setEditing(null)}
              />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
