"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Plus, RotateCw, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";
import {
  createWebhookEndpointAction,
  deleteWebhookEndpointAction,
  resendWebhookDeliveryAction,
  rotateWebhookSecretAction,
  testWebhookAction,
  toggleWebhookEndpointAction,
  updateWebhookEndpointAction,
  type HookState,
} from "./actions";

export type EndpointRow = {
  id: string; url: string; description: string | null; events: string[]; secretHint: string; isActive: boolean;
  disabledReason: string | null; lastDeliveryAt: string | null; lastStatusCode: number | null;
};
export type DeliveryRow = { id: string; endpointId: string; type: string; status: string; attempts: number; lastStatusCode: number | null; lastError: string | null; createdAt: string; nextAttemptAt: string | null };

const stamp = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

function Copy1({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-secondary btn-sm gap-1.5" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* selectable on screen */ } }}>
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {done ? "Copied" : "Copy secret"}
    </button>
  );
}

function SecretView({ secret, url, onClose }: { secret: string; url?: string; onClose: () => void }) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-start gap-2.5 rounded-card border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
        <p className="text-sm text-secondary">Copy this signing secret now. It is shown only once. Your server uses it to check that a message really came from ManpowerSync.</p>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-muted">Signing secret for {url}</p>
        <code className="block break-all rounded-lg border border-default bg-surface-sunken px-3 py-2.5 font-mono text-sm text-primary select-all">{secret}</code>
      </div>
      <div className="flex items-center justify-between">
        <Copy1 text={secret} />
        <button type="button" className="btn btn-primary" onClick={onClose}>I&apos;ve saved it</button>
      </div>
    </div>
  );
}

function EventPicker({ selected }: { selected?: string[] }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium text-muted">Events to send *</legend>
      <div className="space-y-1.5">
        {WEBHOOK_EVENTS.map((e) => (
          <label key={e.type} className="flex items-start gap-2.5 rounded-lg border border-default px-3 py-2 text-sm hover:bg-surface-hover">
            <input type="checkbox" name="events" value={e.type} defaultChecked={selected?.includes(e.type)} className="mt-0.5" />
            <span className="min-w-0">
              <span className="font-medium text-primary">{e.label} <span className="font-mono text-[11px] font-normal text-muted">{e.type}</span></span>
              <span className="block text-xs text-muted">{e.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function EndpointForm({ endpoint, onClose }: { endpoint?: EndpointRow; onClose: () => void }) {
  const [state, setState] = useState<HookState>({ error: null });
  const [pending, start] = useTransition();
  if (state.secret) return <SecretView secret={state.secret} url={state.url} onClose={onClose} />;
  return (
    // onSubmit rather than a form action, so a validation error doesn't wipe what was typed.
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          if (endpoint) {
            const r = await updateWebhookEndpointAction({ error: null }, fd);
            if (r.error) setState({ error: r.error }); else onClose();
          } else setState(await createWebhookEndpointAction(state, fd));
        });
      }}
    >
      {endpoint && <input type="hidden" name="id" value={endpoint.id} />}
      {!endpoint && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Endpoint address *</span>
          <input name="url" required type="url" placeholder="https://your-server.com/webhooks/manpowersync" className="input w-full" />
          <span className="mt-1 block text-xs text-muted">Must start with https:// and be reachable from the internet.</span>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Description (optional)</span>
        <input name="description" maxLength={100} defaultValue={endpoint?.description ?? ""} placeholder="e.g. Zoho Books sync" className="input w-full" />
      </label>
      <EventPicker selected={endpoint?.events} />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : endpoint ? "Save changes" : "Add endpoint"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      </div>
    </form>
  );
}

const statusColor = (s: string) => (s === "SUCCESS" ? "green" : s === "PENDING" ? "amber" : "red");

export function WebhooksManager({ endpoints, deliveries }: { endpoints: EndpointRow[]; deliveries: DeliveryRow[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EndpointRow | null>(null);
  const [secret, setSecret] = useState<{ secret: string; url?: string } | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const hostOf = (u: string) => { try { return new URL(u).host; } catch { return u; } };
  const urlOf = (id: string) => endpoints.find((e) => e.id === id)?.url ?? "";

  const run = (fn: () => Promise<{ error: string | null; message?: string }>) =>
    start(async () => { const r = await fn(); setNote(r.error ? { ok: false, text: r.error } : { ok: true, text: r.message ?? "Done." }); });
  const fd = (id: string, extra: Record<string, string> = {}) => { const f = new FormData(); f.set("id", id); for (const [k, v] of Object.entries(extra)) f.set(k, v); return f; };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-primary">Webhooks</h2>
        <button type="button" className="btn btn-primary gap-1.5" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Add endpoint</button>
      </div>
      <p className="text-sm text-secondary">A webhook tells your software the moment something happens here, so you don&apos;t have to keep asking. We send a small signed message with the ids involved; your server then fetches the details through the API.</p>
      {note && <p role="status" className={`text-sm ${note.ok ? "text-[var(--success)]" : "text-[var(--error)]"}`}>{note.text}</p>}

      {endpoints.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">No webhook endpoints yet.</p></div>
      ) : (
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <div key={ep.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all font-medium text-primary">{ep.url}</p>
                  <p className="text-xs text-muted">{ep.description ? `${ep.description} · ` : ""}Secret ends …{ep.secretHint} · Last sent {stamp(ep.lastDeliveryAt)}{ep.lastStatusCode ? ` (${ep.lastStatusCode})` : ""}</p>
                </div>
                <Badge color={ep.isActive ? "green" : "red"} dot>{ep.isActive ? "On" : "Off"}</Badge>
              </div>
              {!ep.isActive && ep.disabledReason && <p className="text-xs text-[var(--error)]">{ep.disabledReason}</p>}
              <div className="flex flex-wrap gap-1">
                {ep.events.map((t) => <span key={t} className="rounded-md bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-secondary">{t}</span>)}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !ep.isActive} onClick={() => run(() => testWebhookAction(fd(ep.id)))}>Send test event</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(ep)}>Edit</button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run(() => toggleWebhookEndpointAction(fd(ep.id, { active: ep.isActive ? "0" : "1" })))}>{ep.isActive ? "Switch off" : "Switch on"}</button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { if (!confirm("Make a new signing secret? The old one stops working straight away, so update your server first or right after.")) return; start(async () => { const r = await rotateWebhookSecretAction(fd(ep.id)); if (r.secret) setSecret({ secret: r.secret, url: r.url }); else setNote({ ok: false, text: r.error ?? "Could not rotate." }); }); }}>New secret</button>
                <button type="button" className="ml-auto font-medium text-[var(--error)] hover:underline disabled:opacity-50" disabled={busy} onClick={() => { if (!confirm(`Delete this endpoint? Nothing more will be sent to ${hostOf(ep.url)}.`)) return; run(() => deleteWebhookEndpointAction(fd(ep.id))); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">Up to 5 endpoints. If a message fails we retry after 5 seconds, 1 minute, 10 minutes, 1 hour and 6 hours. After 10 messages in a row fail for good, the endpoint is switched off and admins are notified.</p>

      {deliveries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Recent deliveries</h3>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">To</th><th className="px-4 py-3">Result</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2.5 text-secondary">{stamp(d.createdAt)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-primary">{d.type}</td>
                    <td className="px-4 py-2.5 text-xs text-secondary">{hostOf(urlOf(d.endpointId))}</td>
                    <td className="px-4 py-2.5">
                      <Badge color={statusColor(d.status)} dot>{d.status === "SUCCESS" ? `Delivered${d.lastStatusCode ? ` (${d.lastStatusCode})` : ""}` : d.status === "PENDING" ? `Retrying (try ${d.attempts})` : "Failed"}</Badge>
                      {d.status !== "SUCCESS" && d.lastError && <p className="mt-0.5 max-w-xs text-xs text-muted">{d.lastError}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" disabled={busy} title="Send this message again" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline disabled:opacity-50" onClick={() => run(() => resendWebhookDeliveryAction(fd(d.id)))}><RotateCw className="h-3 w-3" aria-hidden /> Resend</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card space-y-3 p-5">
        <h3 className="text-sm font-semibold text-primary">What we send, and how to check it</h3>
        <pre className="overflow-x-auto rounded-lg border border-default bg-surface-sunken p-3 font-mono text-xs text-primary">{`POST https://your-server.com/webhooks/manpowersync
ManpowerSync-Event: timesheet.approved
ManpowerSync-Delivery: evt_3f9a…
ManpowerSync-Signature: t=1767225600,v1=5257a8…

{ "id": "evt_3f9a…", "type": "timesheet.approved", "created": "2026-01-01T00:00:00Z",
  "data": { "timesheet_entry_id": "…" } }`}</pre>
        <p className="text-xs text-secondary">Answer with any 2xx status within 10 seconds. The same event can arrive more than once, so use the <code className="font-mono">id</code> to ignore repeats. To check a message, compute HMAC-SHA256 of <code className="font-mono">{"<t>.<raw body>"}</code> with your signing secret and compare it with <code className="font-mono">v1</code>; reject it if <code className="font-mono">t</code> is more than 5 minutes old.</p>
        <pre className="overflow-x-auto rounded-lg border border-default bg-surface-sunken p-3 font-mono text-xs text-primary">{`// Node.js
const [t, v1] = req.headers["manpowersync-signature"].split(",").map(p => p.split("=")[1]);
const expected = crypto.createHmac("sha256", SECRET).update(t + "." + rawBody).digest("hex");
const ok = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))
  && Math.abs(Date.now() / 1000 - Number(t)) < 300;`}</pre>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent title="Add webhook endpoint" description="Choose where to send messages and which events you want.">{adding && <EndpointForm onClose={() => setAdding(false)} />}</DialogContent>
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title="Edit endpoint" description={editing?.url}>{editing && <EndpointForm endpoint={editing} onClose={() => setEditing(null)} />}</DialogContent>
      </Dialog>
      <Dialog open={!!secret} onOpenChange={(o) => !o && setSecret(null)}>
        <DialogContent title="New signing secret" description="The old secret no longer works.">{secret && <SecretView secret={secret.secret} url={secret.url} onClose={() => setSecret(null)} />}</DialogContent>
      </Dialog>
    </section>
  );
}
