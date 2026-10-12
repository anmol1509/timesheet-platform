"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Plus, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Badge } from "@/components/Badge";
import { API_SCOPES } from "@/lib/api/keys";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

export type KeyRow = { id: string; name: string; prefix: string; scopes: string[]; createdAt: string; createdBy: string; expiresAt: string | null; lastUsedAt: string | null; revoked: boolean };
type State = { error: string | null; secret?: string; name?: string };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const ENDPOINTS: { path: string; scope: string; what: string; params: string }[] = [
  { path: "/me", scope: "any key", what: "Check the key works and see its permissions.", params: "" },
  { path: "/employees", scope: "employees:read", what: "Workers, one page at a time.", params: "status, supplier_id, project_id, updated_since" },
  { path: "/employees/{id}", scope: "employees:read", what: "One worker.", params: "" },
  { path: "/suppliers", scope: "suppliers:read", what: "Suppliers.", params: "" },
  { path: "/clients", scope: "clients:read", what: "Clients.", params: "" },
  { path: "/projects", scope: "projects:read", what: "Projects.", params: "client_id" },
  { path: "/attendance", scope: "attendance:read", what: "Daily attendance and hours.", params: "from, to, employee_code, status, updated_since" },
  { path: "/timesheets", scope: "timesheets:read", what: "Monthly timesheet entries.", params: "month, supplier_id, client_id, status, updated_since" },
  { path: "/invoices", scope: "invoices:read", what: "Client invoices.", params: "month, client_id, status" },
  { path: "/renewals", scope: "renewals:read", what: "Documents expiring soon.", params: "within_days" },
  { path: "/payroll/runs", scope: "payroll:read", what: "Payroll runs.", params: "month, status" },
  { path: "/payroll/runs/{id}/lines", scope: "payroll:read", what: "Each worker's pay line in a run.", params: "" },
];

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm gap-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard blocked: the text is selectable on screen */
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {done ? "Copied" : label}
    </button>
  );
}

function CreateForm({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ error: null });
  const [pending, start] = useTransition();

  if (state.secret) {
    return (
      <div className="mt-4 space-y-4">
        <div className="flex items-start gap-2.5 rounded-card border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
          <p className="text-sm text-secondary">Copy this key now. For your security it is shown only once and we can&apos;t show it again. If you lose it, revoke it and create a new one.</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Key for “{state.name}”</p>
          <code className="block break-all rounded-lg border border-default bg-surface-sunken px-3 py-2.5 font-mono text-sm text-primary select-all">{state.secret}</code>
        </div>
        <div className="flex items-center justify-between">
          <CopyButton text={state.secret} label="Copy key" />
          <button type="button" className="btn btn-primary" onClick={onClose}>
            I&apos;ve saved it
          </button>
        </div>
      </div>
    );
  }

  return (
    // A submit handler rather than a form action: React empties a form after its action runs,
    // which would wipe the name when a permission was forgotten.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setState(await createApiKeyAction(state, fd)));
      }}
      className="mt-4 space-y-4"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Name *</span>
        <input name="name" required maxLength={60} placeholder="e.g. Zoho Books sync" className="input w-full" />
      </label>

      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-muted">Permissions *</legend>
        <div className="space-y-1.5">
          {API_SCOPES.map((s) => (
            <label key={s.key} className="flex items-start gap-2.5 rounded-lg border border-default px-3 py-2 text-sm hover:bg-surface-hover">
              <input type="checkbox" name="scopes" value={s.key} className="mt-0.5" />
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-medium text-primary">
                  {s.label}
                  {s.sensitive && <Badge color="amber">Sensitive</Badge>}
                </span>
                <span className="block text-xs text-muted">{s.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Expires on (optional)</span>
        <DatePicker name="expiresAt" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} className="w-full" />
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create key"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-[var(--error)]">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

export function DevelopersManager({ keys, enabled, branchName, baseUrl, salesEmail, children }: { keys: KeyRow[]; enabled: boolean; branchName: string; baseUrl: string; salesEmail: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [revoking, startRevoke] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = keys.filter((k) => !k.revoked);

  if (!enabled) {
    return (
      <div className="card max-w-2xl space-y-3 p-6">
        <h2 className="text-base font-semibold text-primary">API access is part of the Pro and Custom plans</h2>
        <p className="text-sm text-secondary">
          {branchName ? `${branchName} is` : "This account is"} not on a plan with API access yet. With it you can connect Zoho Books, Tally, attendance devices and your own software.
        </p>
        <a href={`mailto:${salesEmail}?subject=${encodeURIComponent("API access")}`} className="btn btn-primary w-fit">
          Contact us to switch it on
        </a>
      </div>
    );
  }

  const curl = `curl ${baseUrl}/employees?limit=10 \\\n  -H "Authorization: Bearer YOUR_API_KEY"`;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-primary">API keys</h2>
          <button type="button" className="btn btn-primary gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Create API key
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
        {keys.length === 0 ? (
          <div className="empty-state">
            <p className="text-sm text-muted">No API keys yet. Create one, choose what it may read, and paste it into the software you are connecting.</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Permissions</th>
                  <th className="px-4 py-3">Last used</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {keys.map((k) => {
                  const expired = !!k.expiresAt && new Date(k.expiresAt) <= new Date();
                  return (
                    <tr key={k.id} className={k.revoked || expired ? "opacity-60" : ""}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-primary">{k.name}</p>
                        <p className="text-xs text-muted">{k.createdBy} · {when(k.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-secondary">{k.prefix}…</td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {k.scopes.map((s) => (
                            <span key={s} className="rounded-md bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-secondary">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-secondary">{when(k.lastUsedAt)}</td>
                      <td className="px-4 py-3 text-secondary">{when(k.expiresAt)}</td>
                      <td className="px-4 py-3">
                        <Badge color={k.revoked ? "slate" : expired ? "red" : "green"} dot>
                          {k.revoked ? "Revoked" : expired ? "Expired" : "Active"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!k.revoked && (
                          <button
                            type="button"
                            disabled={revoking}
                            className="text-xs font-medium text-[var(--error)] hover:underline disabled:opacity-50"
                            onClick={() => {
                              if (!confirm(`Revoke “${k.name}”? Anything using this key stops working immediately.`)) return;
                              const fd = new FormData();
                              fd.set("id", k.id);
                              startRevoke(async () => setError((await revokeApiKeyAction(fd)).error));
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted">{active.length} active of 10 allowed. Keys can read only this company&apos;s data. This version of the API is read-only.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-primary">Try it</h2>
        <div className="card space-y-3 p-5">
          <p className="text-sm text-secondary">
            Base address: <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs">{baseUrl}</code>. Send your key in the <code className="font-mono text-xs">Authorization</code> header.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-default bg-surface-sunken p-3 font-mono text-xs text-primary">{curl}</pre>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">Lists come back a page at a time. Pass <code className="font-mono">limit</code> (up to 200) and the <code className="font-mono">cursor</code> from the previous page&apos;s <code className="font-mono">next_cursor</code>. Limit: 120 requests a minute per key.</p>
            <CopyButton text={curl} label="Copy example" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-primary">Endpoints</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">GET</th>
                <th className="px-4 py-3">What it returns</th>
                <th className="px-4 py-3">Permission</th>
                <th className="px-4 py-3">Filters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {ENDPOINTS.map((e) => (
                <tr key={e.path}>
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">/api/v1{e.path}</td>
                  <td className="px-4 py-2.5 text-secondary">{e.what}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-secondary">{e.scope}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{e.params || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {children}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Create API key" description="Give it only the permissions the connection needs.">
          {open && <CreateForm onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
