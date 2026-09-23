"use client";

import { useActionState, useEffect, useState } from "react";
import { requestCodeAction, verifyCodeAction } from "./actions";

const INITIAL = { error: null as string | null, sent: false, phone: "", masked: "" };

export function EssLoginForm({ deliveryConfigured }: { deliveryConfigured: boolean }) {
  const [phone, setPhone] = useState("");
  const [reqState, requestAction, requesting] = useActionState(requestCodeAction, INITIAL);
  const [verState, verifyAction, verifying] = useActionState(verifyCodeAction, INITIAL);
  const [cooldown, setCooldown] = useState(0);
  const codeStage = reqState.sent;

  useEffect(() => {
    if (!reqState.sent) return;
    // The timer is a UI nicety; the server enforces the real limit.
    const start = setTimeout(() => setCooldown(45), 0);
    return () => clearTimeout(start);
  }, [reqState]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!codeStage) {
    return (
      <form action={requestAction} className="space-y-4">
        {!deliveryConfigured && (
          <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-secondary">
            Sign-in codes can&apos;t be sent yet. Please ask your administrator.
          </p>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-primary">Mobile number</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+971 50 123 4567"
            className="input h-12 w-full text-base"
          />
          <span className="mt-1 block text-xs text-muted">The number your employer has on file for you.</span>
        </label>
        <button type="submit" disabled={requesting} className="btn btn-primary h-12 w-full text-base">
          {requesting ? "Sending…" : "Send me a code"}
        </button>
        {reqState.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{reqState.error}</p>}
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="phone" value={reqState.phone} />
        <p className="text-sm text-secondary">
          If <span className="font-medium text-primary">{reqState.masked}</span> is registered, we&apos;ve sent a 6-digit code to it.
        </p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-primary">Sign-in code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            placeholder="123456"
            className="input h-12 w-full text-center text-2xl tracking-[0.4em] tabular-nums"
          />
        </label>
        <button type="submit" disabled={verifying} className="btn btn-primary h-12 w-full text-base">
          {verifying ? "Checking…" : "Sign in"}
        </button>
        {verState.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{verState.error}</p>}
      </form>
      <form action={requestAction} className="flex items-center justify-between gap-3 text-sm">
        <input type="hidden" name="phone" value={reqState.phone} />
        <button type="submit" disabled={requesting || cooldown > 0} className="text-[var(--brand-primary)] hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline">
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
        <a href="/me/login" className="text-muted hover:text-secondary">Use a different number</a>
      </form>
      {reqState.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{reqState.error}</p>}
    </div>
  );
}
