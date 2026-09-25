"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Shield, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { PermissionMatrix } from "@/components/settings/PermissionMatrix";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { MODULES, ROLE_PRESETS, permissionKey } from "@/lib/permissions";
import { createUserAction } from "./actions";

type Branch = { id: string; code: string; name: string };
export type AccessRoleOption = { id: string; name: string; description: string | null; permissions: string[]; branchId: string | null };

// One card in step 2. "existing" roles are read-only here (edit them on the
// Roles tab); presets and "custom" start a new role that is saved for reuse.
type Choice =
  | { kind: "admin" }
  | { kind: "none" }
  | { kind: "existing"; role: AccessRoleOption }
  | { kind: "preset"; name: string; description: string; permissions: string[] }
  | { kind: "custom" };

const choiceId = (c: Choice) => (c.kind === "existing" ? `role:${c.role.id}` : c.kind === "preset" ? `preset:${c.name}` : c.kind);

function summary(perms: string[]) {
  const n = MODULES.filter((m) => perms.includes(permissionKey(m.key, "view"))).length;
  return `${n} of ${MODULES.length} modules`;
}

export function AddMemberWizard({
  isSuperAdmin,
  branches,
  accessRoles,
  onDone,
}: {
  isSuperAdmin: boolean;
  branches: Branch[];
  accessRoles: AccessRoleOption[];
  onDone: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");

  const [selected, setSelected] = useState("none");
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [roleName, setRoleName] = useState("");

  const availableRoles = useMemo(
    () => accessRoles.filter((r) => r.branchId === null || !isSuperAdmin || r.branchId === branchId),
    [accessRoles, isSuperAdmin, branchId]
  );
  const choices: Choice[] = useMemo(
    () => [
      { kind: "admin" },
      { kind: "none" },
      ...availableRoles.map((role) => ({ kind: "existing", role }) as Choice),
      ...ROLE_PRESETS.filter((p) => !availableRoles.some((r) => r.name === p.name)).map((p) => ({ kind: "preset", ...p }) as Choice),
      { kind: "custom" },
    ],
    [availableRoles]
  );
  const choice = choices.find((c) => choiceId(c) === selected) ?? choices[1];
  const editable = choice.kind === "preset" || choice.kind === "custom";

  function pick(c: Choice) {
    setSelected(choiceId(c));
    if (c.kind === "preset") {
      setPerms(new Set(c.permissions));
      setRoleName(c.name);
    } else if (c.kind === "custom") {
      setPerms(new Set());
      setRoleName("");
    }
  }

  const digits = phone.replace(/\D/g, "");
  const step1Error =
    !name.trim() ? "Enter the person's name."
    : !/^\S+@\S+\.\S+$/.test(email.trim()) ? "Enter a valid email address."
    : digits.length < 7 ? "Add a phone number."
    : password.length < 8 ? "The temporary password needs at least 8 characters."
    : isSuperAdmin && !branchId ? "Choose a branch."
    : null;

  function next() {
    setError(null);
    if (step1Error) return setError(step1Error);
    setStep(2);
  }

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("email", email);
    fd.set("phone", phone);
    fd.set("jobTitle", jobTitle);
    fd.set("password", password);
    if (isSuperAdmin) fd.set("branchId", branchId);
    fd.set("role", choice.kind === "admin" ? "BRANCH_ADMIN" : "STAFF");
    if (choice.kind === "existing") {
      fd.set("accessMode", "existing");
      fd.set("accessRoleId", choice.role.id);
    } else if (editable) {
      fd.set("accessMode", "new");
      fd.set("newRoleName", roleName);
      for (const p of perms) fd.append("permission", p);
    } else fd.set("accessMode", "none");
    start(async () => {
      const res = await createUserAction({ error: null }, fd);
      if (res.ok) onDone();
      else setError(res.error);
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";
  const reqStar = <span className="text-[var(--error)]"> *</span>;

  return (
    <div className="mt-4">
      <ol className="mb-5 flex items-center gap-3 text-sm" aria-label="Progress">
        {[
          { n: 1, t: "Profile", icon: UserRound },
          { n: 2, t: "Role & permissions", icon: Shield },
        ].map((s, i) => (
          <li key={s.n} className="flex items-center gap-3">
            {i > 0 && <span className="h-px w-8 bg-[var(--border)]" aria-hidden />}
            <span
              className={cn(
                "flex items-center gap-2 font-medium",
                step === s.n ? "text-primary" : step > s.n ? "text-[var(--success)]" : "text-muted"
              )}
              aria-current={step === s.n ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  step === s.n ? "bg-[var(--brand-primary)] text-white" : step > s.n ? "bg-[var(--success-soft)]" : "bg-surface-sunken"
                )}
              >
                {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
              </span>
              {s.t}
            </span>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Full name{reqStar}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" autoFocus />
          </label>
          <label className="block">
            <span className={label}>Job title</span>
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="input w-full" />
          </label>
          <label className="block">
            <span className={label}>Email{reqStar}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" />
          </label>
          <div>
            <span className={label}>Phone{reqStar}</span>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
          <label className="block">
            <span className={label}>Temporary password{reqStar}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="input w-full" />
            <span className="mt-1 block text-xs text-muted">At least 8 characters. They can change it on their profile.</span>
          </label>
          {isSuperAdmin && (
            <label className="block">
              <span className={label}>Branch{reqStar}</span>
              <Select
                value={branchId}
                onChange={setBranchId}
                searchable={false}
                options={branches.map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))}
              />
            </label>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-primary">Choose a role for {name.split(" ")[0] || "them"}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {choices.map((c) => {
                const id = choiceId(c);
                const active = id === selected;
                const meta =
                  c.kind === "admin"
                    ? { t: "Admin", d: "Full access to this branch, including settings and team.", icon: ShieldCheck }
                    : c.kind === "none"
                      ? { t: "Standard staff", d: "All operational modules, nothing administrative.", icon: UserRound }
                      : c.kind === "existing"
                        ? { t: c.role.name, d: c.role.description || summary(c.role.permissions), icon: Shield }
                        : c.kind === "preset"
                          ? { t: c.name, d: `${c.description}`, icon: Sparkles }
                          : { t: "Custom role", d: "Pick exactly which modules and actions they get.", icon: Sparkles };
                const Icon = meta.icon;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => pick(c)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 text-left transition",
                      active ? "border-[var(--brand-primary)] bg-brand-soft" : "border-default hover:bg-surface-hover"
                    )}
                  >
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-[var(--brand-primary)]" : "text-subtle")} aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-primary">{meta.t}</span>
                      <span className="line-clamp-2 text-xs text-muted">{meta.d}</span>
                      {c.kind === "existing" && <span className="mt-0.5 block text-[11px] text-subtle">Saved role · {summary(c.role.permissions)}</span>}
                      {c.kind === "preset" && <span className="mt-0.5 block text-[11px] text-subtle">Template · you can adjust it below</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {(choice.kind === "existing" || editable) && (
            <div className="space-y-3">
              {editable && (
                <label className="block max-w-sm">
                  <span className={label}>Role name{reqStar}</span>
                  <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Site supervisor" className="input w-full" />
                  <span className="mt-1 block text-xs text-muted">Saved on the Roles tab so you can assign it to others later.</span>
                </label>
              )}
              <div>
                {choice.kind === "existing" ? (
                  <PermissionMatrix perms={new Set(choice.role.permissions)} compact />
                ) : (
                  <PermissionMatrix perms={perms} onChange={setPerms} compact />
                )}
              </div>
            </div>
          )}
          {choice.kind === "admin" && (
            <p className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-secondary">
              Admins can open every module and manage settings, team and roles for {isSuperAdmin ? "the chosen branch" : "your branch"}.
            </p>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        {step === 2 && (
          <button type="button" className="btn btn-secondary" onClick={() => setStep(1)} disabled={pending}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </button>
        )}
        {step === 1 ? (
          <button type="button" className="btn btn-primary" onClick={next}>
            Next: role &amp; permissions <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={submit} disabled={pending}>
            {pending ? "Adding…" : "Add team member"}
          </button>
        )}
        {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      </div>
    </div>
  );
}
