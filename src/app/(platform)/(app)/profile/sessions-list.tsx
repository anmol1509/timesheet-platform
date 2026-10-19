"use client";

import { useState, useTransition } from "react";
import { Laptop, Smartphone } from "lucide-react";
import { endSessionAction, signOutOtherDevicesAction } from "./actions";

export type SessionRow = { id: string; label: string; ip: string | null; createdAt: string; lastSeenAt: string; current: boolean; phone: boolean };

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
};

/** The devices signed in to this account, with a way to end any of them. */
export function SessionsList({ rows }: { rows: SessionRow[] }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const others = rows.filter((r) => !r.current).length;
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-default rounded-card border border-default bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            {r.phone ? <Smartphone className="h-5 w-5 shrink-0 text-subtle" aria-hidden /> : <Laptop className="h-5 w-5 shrink-0 text-subtle" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-primary">{r.label}{r.current && <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">This device</span>}</p>
              <p className="text-xs text-muted">{r.current ? "Active now" : `Last used ${ago(r.lastSeenAt)}`}{r.ip ? ` · ${r.ip}` : ""} · signed in {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
            </div>
            {!r.current && <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => { const x = await endSessionAction(r.id); setMsg(x.error ? { ok: false, text: x.error } : { ok: true, text: "Signed out of that device." }); })}>Sign out</button>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => { if (window.confirm("Sign out of every other device? This one stays signed in.")) start(async () => { const x = await signOutOtherDevicesAction(); setMsg(x.error ? { ok: false, text: x.error } : { ok: true, text: "Every other device is signed out." }); }); }}>Sign out of all other devices</button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
      </div>
      <p className="text-xs text-muted">{others === 0 ? "No other device is signed in. " : ""}Sign-ins from before this list existed aren&apos;t shown, but &ldquo;Sign out of all other devices&rdquo; ends those too.</p>
    </div>
  );
}
