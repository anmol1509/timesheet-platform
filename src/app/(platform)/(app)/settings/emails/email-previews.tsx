"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { sendTestEmailAction } from "./actions";

import { Button } from "@/components/ui/Button";
export type EmailSample = { key: string; label: string; subject: string; html: string };

/** Every email the app sends, as it will look, with a button to send the admin a real test. */
export function EmailPreviews({ samples, email }: { samples: EmailSample[]; email: string }) {
  const [active, setActive] = useState(samples[0]?.key ?? "");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error: string | null; ok?: boolean } | null>(null);
  const current = samples.find((s) => s.key === active) ?? samples[0];
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav className="card space-y-1 p-2" aria-label="Emails">
        {samples.map((s) => (
          <button key={s.key} type="button" onClick={() => setActive(s.key)} className={cn("block w-full rounded-lg px-3 py-2 text-left text-sm transition", s.key === active ? "bg-brand-soft font-medium text-primary" : "text-secondary hover:bg-surface-hover")}>{s.label}</button>
        ))}
      </nav>
      <div className="space-y-3">
        <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="min-w-0 text-sm text-secondary"><span className="text-xs font-medium tracking-wide text-muted uppercase">Subject</span><br /><span className="text-primary">{current?.subject}</span></p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="btn-sm" type="button" disabled={pending} onClick={() => { setResult(null); start(async () => setResult(await sendTestEmailAction())); }} loading={pending}>Send me a test</Button>
          </div>
          {result?.error && <p role="alert" className="w-full text-xs text-[var(--error)]">{result.error}</p>}
          {result?.ok && <p className="w-full text-xs text-[var(--success)]">Sent to {email}. Check your inbox.</p>}
        </div>
        {current && (
          <iframe key={current.key} title={current.label} srcDoc={current.html} sandbox="" className="h-[720px] w-full rounded-xl border border-default bg-white" />
        )}
      </div>
    </div>
  );
}
