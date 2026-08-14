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
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary w-full px-3 py-3 font-semibold"
      >
        {pending ? "Logging in…" : "Log In"}
      </button>

      <p className="text-center text-sm text-muted">
        Forgot your password? Contact your site administrator.
      </p>
    </form>
  );
}
