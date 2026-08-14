"use client";

import { useActionState, useState } from "react";
import { createUserAction } from "./actions";
import { Select } from "@/components/ui/Select";

type Branch = { id: string; code: string; name: string };

export function CreateUserForm({
  isSuperAdmin,
  branches,
}: {
  isSuperAdmin: boolean;
  branches: Branch[];
}) {
  const [state, formAction, pending] = useActionState(createUserAction, {
    error: null,
  });
  const [role, setRole] = useState(isSuperAdmin ? "BRANCH_ADMIN" : "STAFF");

  const roleOptions = isSuperAdmin
    ? [
        { value: "SUPER_ADMIN", label: "Super Admin (all branches)" },
        { value: "BRANCH_ADMIN", label: "Branch Admin" },
        { value: "STAFF", label: "Staff" },
      ]
    : [
        { value: "BRANCH_ADMIN", label: "Branch Admin" },
        { value: "STAFF", label: "Staff" },
      ];

  return (
    <form action={formAction} className="space-y-3">
      <input
        name="name"
        placeholder="Full name"
        required
        className="input w-full"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="input w-full"
      />
      <input
        name="password"
        type="password"
        placeholder="Temporary password (min 8 characters)"
        required
        minLength={8}
        className="input w-full"
      />
      <Select
        name="role"
        value={role}
        onChange={setRole}
        searchable={false}
        options={roleOptions}
      />
      {isSuperAdmin && role !== "SUPER_ADMIN" && (
        <Select
          name="branchId"
          placeholder="Branch"
          searchable={false}
          options={branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))}
        />
      )}
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary w-full px-3"
      >
        {pending ? "Adding…" : "Add user"}
      </button>
    </form>
  );
}
