"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { completeMyProfileAction, type ProfileResult } from "./actions";
import { COUNTRY_NAMES, type ProfileField } from "@/lib/ess/profileFields";

export function ProfileForm({ missing }: { missing: ProfileField[] }) {
  const [res, action, pending] = useActionState<ProfileResult, FormData>(completeMyProfileAction, null);
  return (
    <form action={action} className="card space-y-4 p-5">
      {res && res.saved > 0 && Object.keys(res.errors).length === 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Saved {res.saved} detail{res.saved === 1 ? "" : "s"}. Thank you.
        </p>
      )}
      {res?.errors._ && <p className="rounded-lg bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">{res.errors._}</p>}
      {missing.map((f) => (
        <label key={f.key} className="block">
          <span className="mb-1 block text-sm font-medium text-primary">{f.label}</span>
          {f.kind === "gender" ? (
            <select name={f.key} defaultValue={res?.values?.[f.key] ?? ""} className="input w-full"><option value="">Choose…</option><option>Male</option><option>Female</option></select>
          ) : f.kind === "country" ? (
            <>
              <input name={f.key} list="countries" defaultValue={res?.values?.[f.key] ?? ""} placeholder="Start typing your country" className="input w-full" autoComplete="off" />
              <datalist id="countries">{COUNTRY_NAMES.map((c) => <option key={c} value={c} />)}</datalist>
            </>
          ) : f.kind === "date" ? (
            <input name={f.key} type="date" defaultValue={res?.values?.[f.key] ?? ""} className="input w-full" />
          ) : (
            <input name={f.key} type="text" defaultValue={res?.values?.[f.key] ?? ""} className="input w-full" autoComplete="off" />
          )}
          {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
          {res?.errors[f.key] && <span className="mt-1 block text-xs text-[var(--error)]">{res.errors[f.key]}</span>}
        </label>
      ))}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? "Saving…" : "Save my details"}</button>
      <p className="text-xs text-muted">Leave a box empty if you don&rsquo;t have it to hand. You can come back any time.</p>
    </form>
  );
}
