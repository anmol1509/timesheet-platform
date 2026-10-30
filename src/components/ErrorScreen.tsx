"use client";

import { CopyButton } from "@/components/ui/CopyButton";

/**
 * The one look for a page that could not be shown: a floating badge inside soft rings, a short headline, one calm sentence,
 * the actions, and a reference the person can copy and send to support. It takes the accent colour, so it matches the app.
 */
export function ErrorScreen({ icon, tone = "error", title, message, reference, children }: { icon: React.ReactNode; tone?: "error" | "neutral"; title: string; message: string; reference?: string; children: React.ReactNode }) {
  const color = tone === "error" ? "var(--error)" : "var(--brand-primary)";
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl" style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${color} 16%, transparent), transparent)` }} />
      <div className="relative w-full max-w-lg text-center">
        <div className="relative mx-auto mb-8 flex h-28 w-28 items-center justify-center">
          <span aria-hidden className="err-ring absolute inset-0 rounded-full border" style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }} />
          <span aria-hidden className="err-ring absolute inset-0 rounded-full border" style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)`, animationDelay: "1.6s" }} />
          <span aria-hidden className="absolute inset-3 rounded-full" style={{ background: `color-mix(in srgb, ${color} 9%, var(--surface, #fff))` }} />
          <span className="err-float relative flex h-16 w-16 items-center justify-center rounded-2xl border bg-surface shadow-lg" style={{ color, borderColor: `color-mix(in srgb, ${color} 22%, var(--border, #e6e8ef))` }}>
            {icon}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary sm:text-[28px]">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">{message}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>
        {reference && (
          <div className="mx-auto mt-10 flex max-w-sm flex-col items-center gap-2 border-t border-default pt-6">
            <p className="text-xs text-subtle">If it keeps happening, send support this reference</p>
            <div className="flex items-center gap-2">
              <code className="rounded-md bg-surface-sunken px-2.5 py-1.5 font-mono text-xs text-secondary">{reference}</code>
              <CopyButton text={reference} label="Copy" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
