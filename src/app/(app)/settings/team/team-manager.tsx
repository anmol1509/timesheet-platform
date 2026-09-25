"use client";

import { PhoneField } from "@/components/ui/PhoneField";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { KeyRound, Pencil, Plus, UserCheck, UserX } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { DeleteButton } from "@/components/DeleteButton";
import { Avatar } from "@/components/Avatar";
import { AddMemberWizard, type AccessRoleOption as WizardRole } from "./add-member-wizard";
import {
  createUserAction,
  deleteUserAction,
  resetUserPasswordAction,
  setUserActiveAction,
  updateUserAction,
} from "./actions";

type State = { error: string | null; ok?: boolean };
type Branch = { id: string; code: string; name: string };
type AccessRoleOption = WizardRole;
export type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "BRANCH_ADMIN" | "STAFF";
  branchId: string | null;
  branchCode: string | null;
  accessRoleId: string | null;
  accessRoleName: string | null;
  phone: string | null;
  jobTitle: string | null;
  isActive: boolean;
  avatarUrl: string | null;
  isSelf: boolean;
  canManage: boolean;
};

const ROLE_LABELS = { SUPER_ADMIN: "Super admin", BRANCH_ADMIN: "Branch admin", STAFF: "Staff" };

function Feedback({ state }: { state: State }) {
  if (state.error) return <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>;
  return null;
}

function UserForm({
  user,
  isSuperAdmin,
  branches,
  accessRoles,
  onDone,
}: {
  user?: TeamUser;
  isSuperAdmin: boolean;
  branches: Branch[];
  accessRoles: AccessRoleOption[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      const res = await (user ? updateUserAction : createUserAction)(prev, fd);
      if (res.ok) onDone();
      return res;
    },
    { error: null } as State
  );
  const [role, setRole] = useState<string>(user?.role ?? "STAFF");
  const [branchId, setBranchId] = useState(user?.branchId ?? branches[0]?.id ?? "");
  const editingSelf = user?.isSelf ?? false;

  const roleOptions = [
    ...(isSuperAdmin ? [{ value: "SUPER_ADMIN", label: "Super admin (all branches)" }] : []),
    { value: "BRANCH_ADMIN", label: "Branch admin — full access to the branch" },
    { value: "STAFF", label: "Staff — limited by a permission set" },
  ];
  // Roles usable for this user: global ones, plus ones scoped to their branch.
  const effectiveBranch = isSuperAdmin ? branchId : (user?.branchId ?? null);
  const roleChoices = accessRoles.filter((r) => r.branchId === null || r.branchId === effectiveBranch || !effectiveBranch);

  return (
    <form action={action} className="mt-4 space-y-3">
      {user && <input type="hidden" name="userId" value={user.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Full name *</span>
          <input name="name" defaultValue={user?.name} required className="input w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Email *</span>
          <input name="email" type="email" defaultValue={user?.email} required={!user} disabled={!!user} className="input w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Phone</span>
          <PhoneField name="phone" defaultValue={user?.phone ?? ""} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Job title</span>
          <input name="jobTitle" defaultValue={user?.jobTitle ?? ""} className="input w-full" />
        </label>
        {!user && (
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted">Temporary password (they can change it on their profile) *</span>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input w-full" />
          </label>
        )}
        {!editingSelf && (
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted">Access level</span>
            <Select name="role" value={role} onChange={setRole} searchable={false} options={roleOptions} />
          </label>
        )}
        {isSuperAdmin && role !== "SUPER_ADMIN" && !editingSelf && (
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted">Branch</span>
            <Select
              name="branchId"
              value={branchId}
              onChange={setBranchId}
              searchable={false}
              options={branches.map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))}
            />
          </label>
        )}
        {role === "STAFF" && !editingSelf && (
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted">Permission set (what they can open and do)</span>
            <Select
              key={effectiveBranch ?? "all"}
              name="accessRoleId"
              defaultValue={user?.accessRoleId && roleChoices.some((r) => r.id === user.accessRoleId) ? user.accessRoleId : ""}
              searchable={false}
              options={[
                { value: "", label: "No restriction (all operational modules)" },
                ...roleChoices.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
            <span className="mt-1 block text-xs text-muted">Create sets under Roles &amp; Permissions.</span>
          </label>
        )}
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : user ? "Save changes" : "Add team member"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

function ResetPasswordForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      const res = await resetUserPasswordAction(prev, fd);
      if (res.ok) onDone();
      return res;
    },
    { error: null } as State
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <input name="password" type="password" required minLength={8} placeholder="New temporary password" autoComplete="new-password" className="input w-full" />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Set password"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function TeamManager({
  users,
  branches,
  accessRoles,
  isSuperAdmin,
}: {
  users: TeamUser[];
  branches: Branch[];
  accessRoles: AccessRoleOption[];
  isSuperAdmin: boolean;
}) {
  const [dialog, setDialog] = useState<{ kind: "add" } | { kind: "edit"; user: TeamUser } | { kind: "password"; user: TeamUser } | null>(null);
  const [, start] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);
  const router = useRouter();
  const close = () => {
    setDialog(null);
    router.refresh();
  };

  function toggleActive(u: TeamUser) {
    setRowError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("userId", u.id);
      fd.set("active", u.isActive ? "0" : "1");
      const res = await setUserActiveAction(fd);
      if (res.error) setRowError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{users.length} {users.length === 1 ? "person" : "people"} can sign in.</p>
        <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: "add" })}>
          <Plus className="h-4 w-4" aria-hidden /> Add team member
        </button>
      </div>
      {rowError && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{rowError}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Access</th>
              {isSuperAdmin && <th className="px-4 py-3">Branch</th>}
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} url={u.avatarUrl} className="h-8 w-8 text-xs" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-primary">
                        {u.name} {u.isSelf && <span className="text-xs font-normal text-muted">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-muted">{u.jobTitle ? `${u.jobTitle} · ` : ""}{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-secondary">
                  <p>{ROLE_LABELS[u.role]}</p>
                  {u.role === "STAFF" && (
                    <p className="text-xs text-muted">
                      {u.accessRoleName ? (
                        <Link href="/settings/roles" className="hover:text-primary hover:underline">{u.accessRoleName}</Link>
                      ) : (
                        "No restriction"
                      )}
                    </p>
                  )}
                </td>
                {isSuperAdmin && <td className="px-4 py-3 text-secondary">{u.branchCode ?? "All"}</td>}
                <td className="px-4 py-3">
                  <span className={u.isActive ? "text-[var(--success-text,#067647)]" : "text-muted"}>
                    {u.isActive ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.canManage && (
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-secondary" aria-label={`Edit ${u.name}`} onClick={() => setDialog({ kind: "edit", user: u })}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-secondary" aria-label={`Reset password for ${u.name}`} onClick={() => setDialog({ kind: "password", user: u })}>
                        <KeyRound className="h-4 w-4" />
                      </button>
                      {!u.isSelf && (
                        <>
                          <button type="button" className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-secondary" aria-label={u.isActive ? `Suspend ${u.name}` : `Reactivate ${u.name}`} title={u.isActive ? "Suspend sign-in" : "Reactivate"} onClick={() => toggleActive(u)}>
                            {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>
                          <DeleteButton
                            action={deleteUserAction}
                            hiddenFields={{ userId: u.id }}
                            confirmMessage={`Remove "${u.name}" (${u.email})? They lose access immediately. If they have records on file, suspend them instead.`}
                            label="Remove"
                          />
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && close()}>
        {dialog?.kind === "add" && (
          <DialogContent title="Add team member" description="Set up their profile, then choose what they can open and do. Nothing is created until the last step." className="max-w-3xl">
            <AddMemberWizard isSuperAdmin={isSuperAdmin} branches={branches} accessRoles={accessRoles} onDone={close} />
          </DialogContent>
        )}
        {dialog?.kind === "edit" && (
          <DialogContent title={`Edit ${dialog.user.name}`}>
            <UserForm key={dialog.user.id} user={dialog.user} isSuperAdmin={isSuperAdmin} branches={branches} accessRoles={accessRoles} onDone={close} />
          </DialogContent>
        )}
        {dialog?.kind === "password" && (
          <DialogContent title={`Reset password for ${dialog.user.name}`} description="Set a new temporary password and share it with them.">
            <ResetPasswordForm userId={dialog.user.id} onDone={close} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
