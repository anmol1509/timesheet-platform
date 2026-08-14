"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { devLoginAction, loginAction } from "./actions";
import { Checkbox } from "@/components/ui/Checkbox";

export function LoginForm({
  /** Renders the temporary password-free sign-in button. */
  allowPasswordless = false,
}: {
  allowPasswordless?: boolean;
}) {
  const [state, formAction, pending] = useActionState(loginAction, {
    error: null,
  });
  const [devState, devFormAction, devPending] = useActionState(
    async () => devLoginAction(),
    { error: null }
  );

  return (
    <div className="space-y-5">
      {allowPasswordless && (
        <form action={devFormAction}>
          <button
            type="submit"
            disabled={devPending}
            className="btn btn-primary w-full px-3 py-3 font-semibold"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            {devPending ? "Signing in…" : "Continue as admin"}
          </button>
          {devState.error && (
            <p className="mt-2 rounded-lg bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">
              {devState.error}
            </p>
          )}
          <p className="mt-2 text-center text-xs text-subtle">
            Temporary access while the app is being built — no password
            required.
          </p>
        </form>
      )}

      {allowPasswordless && (
        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-xs text-subtle">or sign in</span>
          <span className="h-px flex-1 bg-[var(--border)]" />
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-secondary"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input w-full py-2.5"
            placeholder="you@burjalaweer.com"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-secondary"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="input w-full py-2.5"
            placeholder="••••••••"
          />
        </div>

        <Checkbox name="remember" value="on" label="Remember Me" />

        {state.error && (
          <p className="rounded-lg bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className={`btn w-full px-3 py-3 font-semibold ${
            allowPasswordless ? "btn-secondary" : "btn-primary"
          }`}
        >
          {pending ? "Logging in…" : "Log In"}
        </button>

        <p className="text-center text-sm text-muted">
          Forgot your password? Contact your site administrator.
        </p>
      </form>
    </div>
  );
}
