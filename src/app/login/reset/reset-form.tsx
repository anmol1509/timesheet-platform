"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { resetPasswordAction } from "../reset-actions";

const FIELD =
  "block w-full rounded-full border border-strong bg-surface px-5 py-3 pr-12 text-sm text-primary transition outline-none placeholder:text-subtle hover:border-[#b9bfc9] focus:border-[var(--brand-primary)] focus:shadow-[0_0_0_3px_rgb(86_69_212_/_0.12)] disabled:cursor-not-allowed disabled:bg-surface-sunken";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, { error: null } as { error: string | null });
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {(["password", "confirm"] as const).map((name, i) => (
        <div key={name}>
          <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-secondary">
            {i === 0 ? "New password" : "Confirm new password"}
          </label>
          <div className="relative">
            <input
              id={name}
              name={name}
              type={show ? "text" : "password"}
              required
              minLength={8}
              autoFocus={i === 0}
              autoComplete="new-password"
              disabled={pending}
              placeholder="••••••••"
              className={FIELD}
            />
            {i === 0 && (
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide passwords" : "Show passwords"}
                aria-pressed={show}
                tabIndex={-1}
                className="absolute top-1/2 right-4 -translate-y-1/2 text-subtle transition hover:text-secondary"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      ))}

      {state.error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl bg-[var(--error-soft)] px-4 py-2.5 text-sm text-[var(--error)]">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            {state.error}
            {state.error.includes("expired") && (
              <>
                {" "}
                <a href="/login/forgot" className="font-medium underline">
                  Get a new link
                </a>
              </>
            )}
          </span>
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-navy)] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-70"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Saving…
          </>
        ) : (
          <>
            Update password
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </>
        )}
      </button>
    </form>
  );
}
