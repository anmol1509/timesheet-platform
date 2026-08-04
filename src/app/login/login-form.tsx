"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { Checkbox } from "@/components/ui/Checkbox";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E2A6E] focus:ring-1 focus:ring-[#1E2A6E]"
          placeholder="you@burjalaweer.com"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E2A6E] focus:ring-1 focus:ring-[#1E2A6E]"
          placeholder="••••••••"
        />
      </div>

      <Checkbox name="remember" value="on" label="Remember Me" />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#E12A2A] px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c72222] disabled:opacity-60"
      >
        {pending ? "Logging in…" : "Log In"}
      </button>

      <p className="text-center text-sm text-slate-500">
        Forgot your password? Contact your site administrator.
      </p>
    </form>
  );
}
