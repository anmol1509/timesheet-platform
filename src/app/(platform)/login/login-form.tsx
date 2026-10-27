"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, ArrowRight, Eye, EyeOff, Headset, Loader2, Lock, Mail } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { loginAction } from "./actions";

/** Pill-shaped input — the one departure from `.input` (8px control radius)
 * in the whole app, scoped to this file only. Matches the login-only radius
 * exception in globals.css (.login-brand-panel + rounded-l-full on the panel). */
const FIELD =
  "block w-full rounded-full border border-strong bg-surface py-3.5 pr-5 pl-12 text-[16px] text-primary transition outline-none placeholder:text-subtle hover:border-[#b9bfc9] focus:border-[var(--brand-primary)] focus:shadow-[0_0_0_3px_rgb(86_69_212_/_0.12)] disabled:cursor-not-allowed disabled:bg-surface-sunken";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, {
    error: null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-[15px] font-medium text-[#14132b]">
          Email address
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-4 h-[18px] w-[18px] -translate-y-1/2 text-subtle" aria-hidden />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            disabled={pending}
            placeholder="you@company.com"
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-[15px] font-medium text-[#14132b]">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-4 h-[18px] w-[18px] -translate-y-1/2 text-subtle" aria-hidden />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            disabled={pending}
            placeholder="••••••••"
            className={`${FIELD} pr-12`}
            onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            tabIndex={-1}
            className="absolute top-1/2 right-4 -translate-y-1/2 text-subtle transition hover:text-secondary"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {capsLock && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--warning)]">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            Caps Lock is on
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="[&_label]:text-[15px]"><Checkbox name="remember" value="on" label="Remember me" /></span>
        <a href="/login/forgot" className="text-[15px] font-medium text-[var(--brand-primary)] hover:underline">
          Forgot password?
        </a>
      </div>

      {state.error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-full bg-[var(--error-soft)] px-4 py-2.5 text-[14px] text-[var(--error)]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-navy)] text-[17px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-70"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </>
        )}
      </button>

      <div className="flex items-center gap-4 rounded-2xl bg-[#f4f2ff] px-5 py-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#e8e4ff] text-[var(--brand-primary)]">
          <Headset className="h-6 w-6" strokeWidth={1.7} aria-hidden />
        </span>
        <p className="text-[14px] leading-5 text-secondary">
          <span className="block text-[15px] font-semibold text-[#14132b]">Need access?</span>
          Contact your site administrator to get your account.
        </p>
      </div>
    </form>
  );
}
