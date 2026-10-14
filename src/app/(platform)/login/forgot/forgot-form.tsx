"use client";

import { useActionState } from "react";
import { AlertTriangle, ArrowRight, Loader2, MailCheck } from "lucide-react";
import { requestPasswordResetAction } from "../reset-actions";

const FIELD =
  "block w-full rounded-full border border-strong bg-surface px-5 py-3 text-sm text-primary transition outline-none placeholder:text-subtle hover:border-[#b9bfc9] focus:border-[var(--brand-primary)] focus:shadow-[0_0_0_3px_rgb(86_69_212_/_0.12)] disabled:cursor-not-allowed disabled:bg-surface-sunken";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, { error: null } as { error: string | null; done?: boolean });

  if (state.done) {
    return (
      <div role="status" className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--success-border,#bfe8d0)] bg-[var(--success-soft)] p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--success)]" aria-hidden />
          <div className="text-sm text-secondary">
            <p className="font-medium text-primary">Check your email</p>
            <p className="mt-1">If an account exists for that address, we&apos;ve sent a link to reset the password. It works once and expires in 1 hour.</p>
          </div>
        </div>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Open the email from ManpowerSync (check spam if you don&apos;t see it).</li>
          <li>Click the link and choose a new password.</li>
          <li>Sign in with the new password.</li>
        </ol>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-secondary">
          Email address
        </label>
        <input id="email" name="email" type="email" required autoFocus autoComplete="email" disabled={pending} placeholder="you@company.com" className={FIELD} />
      </div>

      {state.error && (
        <p role="alert" className="flex items-center gap-2 rounded-full bg-[var(--error-soft)] px-4 py-2.5 text-sm text-[var(--error)]">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {state.error}
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
            Sending…
          </>
        ) : (
          <>
            Send reset link
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </>
        )}
      </button>
      <p className="text-center text-sm text-muted">Can&apos;t get in? Ask your site administrator to reset it for you.</p>
    </form>
  );
}
