"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction } from "./actions";
import { saveNotificationPrefsAction } from "../notifications/actions";

type State = { error: string | null; ok?: boolean };
const INITIAL: State = { error: null };

function Message({ state, success }: { state: State; success: string }) {
  if (state.error) return <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm text-[var(--success-text,#067647)]">{success}</p>;
  return null;
}

export function ProfileForm({
  name,
  email,
  phone,
  jobTitle,
}: {
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, INITIAL);
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Full name</span>
        <input name="name" defaultValue={name} required className="input w-full" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Email (used to sign in)</span>
        <input value={email} disabled className="input w-full" readOnly />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Phone</span>
          <input name="phone" defaultValue={phone} className="input w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Job title</span>
          <input name="jobTitle" defaultValue={jobTitle} className="input w-full" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        <Message state={state} success="Profile saved." />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, INITIAL);
  return (
    <form action={action} className="space-y-3" key={state.ok ? "done" : "form"}>
      <input name="current" type="password" placeholder="Current password" required autoComplete="current-password" className="input w-full" />
      <input name="next" type="password" placeholder="New password (min 8 characters)" required minLength={8} autoComplete="new-password" className="input w-full" />
      <input name="confirm" type="password" placeholder="Confirm new password" required minLength={8} autoComplete="new-password" className="input w-full" />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Updating…" : "Change password"}
        </button>
        <Message state={state} success="Password changed." />
      </div>
    </form>
  );
}

export function NotificationPrefsForm({
  notifyEmail,
  notifyWhatsapp,
  whatsappNumber,
}: {
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
  whatsappNumber: string;
}) {
  const [state, action, pending] = useActionState(saveNotificationPrefsAction, INITIAL);
  return (
    <form action={action} className="space-y-3">
      <p className="text-xs text-muted">In-app notifications are always on. Choose where else to be told.</p>
      <label className="flex items-center gap-2 text-sm text-secondary">
        <input type="checkbox" name="notifyEmail" defaultChecked={notifyEmail} /> Email me
      </label>
      <label className="flex items-center gap-2 text-sm text-secondary">
        <input type="checkbox" name="notifyWhatsapp" defaultChecked={notifyWhatsapp} /> WhatsApp me
      </label>
      <input name="whatsappNumber" defaultValue={whatsappNumber} placeholder="+971501234567" className="input w-full" />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <Message state={state} success="Saved." />
      </div>
    </form>
  );
}
