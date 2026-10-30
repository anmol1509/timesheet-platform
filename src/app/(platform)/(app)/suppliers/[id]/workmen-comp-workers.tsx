"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { addWorkmenCompEmployeeAction, undoWorkmenCompEmployeeAction, getWorkmenCompWorkersAction, saveInsuredNamesAction, setWorkmenCompLinkAction, type WcWorker, type WcWorkers } from "../actions";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
/**
 * Who is on one policy. Every name read off the certificate is listed with the workers it matches, and whether each is
 * linked to this policy, linked to another one, or not linked yet, with a button to link (the file is then filed on that
 * worker's profile) or unlink. A worker the name did not match can be linked from the list at the bottom.
 */
export function WorkmenCompWorkers({ supplierId, attachmentId, filename, canEdit, onChanged }: { supplierId: string; attachmentId: string; filename: string; canEdit: boolean; onChanged: () => void }) {
  const [data, setData] = useState<WcWorkers | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pick, setPick] = useState("");
  // Workers added from this list just now, so each can be taken back.
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [, start] = useTransition();

  const load = useCallback(() => {
    getWorkmenCompWorkersAction(supplierId, attachmentId).then((r) => { if ("error" in r) setError(r.error); else { setError(null); setData(r); } });
  }, [supplierId, attachmentId]);
  useEffect(() => { load(); }, [load]);

  function setLink(employeeId: string, linked: boolean) {
    setBusy(employeeId);
    start(async () => {
      const r = await setWorkmenCompLinkAction(supplierId, attachmentId, employeeId, linked);
      setBusy(null);
      if (r.error) setError(r.error); else { load(); onChanged(); }
    });
  }

  function addWorker(name: string, force = false) {
    setBusy(`add:${name}`);
    start(async () => {
      const r = await addWorkmenCompEmployeeAction(supplierId, attachmentId, name, force);
      setBusy(null);
      // The same name already exists outside this group: ask before adding a second one.
      if (r.duplicate) { if (window.confirm(`${r.error}\n\nAdd anyway?`)) addWorker(name, true); return; }
      if (r.error) setError(r.error);
      else { setError(null); if (r.created && r.employeeId) setAdded((cur) => new Set(cur).add(r.employeeId!)); load(); onChanged(); }
    });
  }

  function undoAdd(employeeId: string) {
    setBusy(`undo:${employeeId}`);
    start(async () => {
      const r = await undoWorkmenCompEmployeeAction(supplierId, attachmentId, employeeId);
      setBusy(null);
      if (r.error) setError(r.error);
      else { setError(null); setAdded((cur) => { const n = new Set(cur); n.delete(employeeId); return n; }); load(); onChanged(); }
    });
  }

  // A certificate from before names were kept: read the file again, once, to list who is on it.
  async function readAgain() {
    setReading(true);
    setError(null);
    try {
      const blob = await fetch(`/api/attachments/${attachmentId}`).then((r) => (r.ok ? r.blob() : Promise.reject(new Error("open"))));
      const body = new FormData();
      body.append("file", new File([blob], filename, { type: blob.type }));
      const json = await fetch("/api/documents/extract-employees", { method: "POST", body }).then((r) => (r.ok ? r.json() : null));
      const names = ((json?.employees ?? []) as { name: string | null }[]).map((x) => x.name ?? "").filter(Boolean);
      const saved = await saveInsuredNamesAction(supplierId, attachmentId, names);
      if (saved.error) setError(saved.error); else load();
    } catch {
      setError("Could not read that certificate again.");
    }
    setReading(false);
  }

  if (error && !data) return <Alert>{error}</Alert>;
  if (!data) return <p className="flex items-center gap-1.5 px-4 py-3 text-sm text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>;

  const named = data.names ?? [];
  // Everyone of the group, the closest names to the one on the certificate first, then this company's own workers.
  const matchOptions = (typed: string) => {
    const words = new Set(typed.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    const overlap = (w: WcWorker) => w.name.toLowerCase().split(/[^a-z0-9]+/).filter((x) => words.has(x)).length;
    return data.roster
      .filter((w) => w.linkedTo !== "this")
      .map((w) => ({ w, score: overlap(w) }))
      .sort((a, b) => b.score - a.score || Number(b.w.own) - Number(a.w.own) || a.w.name.localeCompare(b.w.name))
      .map(({ w }) => ({ value: w.employeeId, label: `${w.name} · ${w.employeeIdNo}${w.trade ? ` · ${w.trade}` : ""}${w.company ? `: ${w.company}` : ""}${w.linkedTo === "other" ? " (on another policy)" : ""}` }));
  };
  const linkedHere = data.roster.filter((w) => w.linkedTo === "this").length;
  const notOnRoster = named.filter((n) => n.candidates.length === 0).length;
  const unlinked = data.roster.filter((w) => w.linkedTo === null);

  const action = (w: WcWorker) => {
    if (!canEdit) return null;
    if (added.has(w.employeeId)) return <span className="flex items-center gap-2 text-xs"><span className="text-[var(--success)]">Added</span><button type="button" disabled={busy !== null} onClick={() => undoAdd(w.employeeId)} className="font-medium text-[var(--error)] hover:underline">{busy === `undo:${w.employeeId}` ? "…" : "Undo"}</button></span>;
    const b = busy === w.employeeId;
    if (w.linkedTo === "this") return <button type="button" disabled={b} onClick={() => setLink(w.employeeId, false)} className="text-xs font-medium text-muted hover:text-error hover:underline">{b ? "…" : "Unlink"}</button>;
    return <button type="button" disabled={b} onClick={() => setLink(w.employeeId, true)} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">{b ? "…" : w.linkedTo === "other" ? "Move here" : "Link"}</button>;
  };
  const state = (w: WcWorker) =>
    w.linkedTo === "this" ? <Badge color="green"><Check className="mr-0.5 inline h-3 w-3" aria-hidden />Linked to this policy</Badge>
    : w.linkedTo === "other" ? <Badge color="amber">On another policy: {w.otherFile}</Badge>
    : <Badge color="slate">Not linked</Badge>;
  const workerLine = (w: WcWorker) => (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
      <Link href={`/employees/${w.employeeId}`} target="_blank" rel="noopener noreferrer" className="truncate text-sm text-primary hover:underline">{w.name} <span className="tabular text-xs text-subtle">{w.employeeIdNo}</span></Link>
      {!w.active && <Badge color="slate">Inactive</Badge>}
      {!w.own && w.company && <Badge color="blue">{w.company}</Badge>}
      {state(w)}
    </span>
  );

  return (
    <div className="space-y-3 border-t border-default bg-surface-subtle px-4 py-3">
      {data.names === null ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
          <span>The names on this certificate were not kept when it was uploaded.</span>
          {canEdit && <Button variant="secondary" size="btn-sm" type="button" disabled={reading} onClick={readAgain} loading={reading}>Read the names from the file</Button>}
          <span className="w-full text-xs text-muted">{linkedHere} worker{linkedHere === 1 ? " is" : "s are"} linked to it.</span>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted">
            {named.length} name{named.length === 1 ? "" : "s"} on the certificate · <span className="font-medium text-primary">{named.filter((n) => n.candidates.some((c) => c.linkedTo === "this")).length} linked here</span>
            {notOnRoster > 0 && <> · {notOnRoster} not on this company&rsquo;s roster</>}
          </p>
          <ul className="divide-y divide-[var(--border)] rounded-md border border-default bg-surface">
            {named.map((n, i) => (
              <li key={`${n.name}-${i}`} className="space-y-1 px-3 py-2">
                {n.candidates.length === 0 && n.suggestions.length > 0 && (
                  <div className="space-y-1 text-sm">
                    <p className="text-xs text-muted">Did you mean{n.suggestions.length > 1 ? " one of these" : ""}? Their name is close to &ldquo;{n.name}&rdquo;.</p>
                    {n.suggestions.map((w) => (
                      <div key={w.employeeId} className="flex flex-wrap items-center gap-2">
                        {workerLine(w)}
                        {action(w)}
                      </div>
                    ))}
                  </div>
                )}
                {n.candidates.length === 0 ? (
                  <div className="space-y-2 rounded-md bg-surface-subtle p-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-primary">{n.name}</span>
                      <Badge color="red">No worker with this name yet</Badge>
                      {n.elsewhere.length > 0 && <span className="text-xs text-[var(--warning)]">Same name at {n.elsewhere.map((o) => `${o.company ?? "another company"} (${o.employeeIdNo})`).join(", ")}.</span>}
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-96 max-w-full">
                          <Select value="" onChange={(id) => { if (id) setLink(id, true); }} searchable placeholder="Match to an existing worker…" options={matchOptions(n.name)} />
                        </div>
                        <span className="text-xs text-muted">or</span>
                        <Button variant="secondary" size="btn-sm" type="button" disabled={busy !== null} onClick={() => addWorker(n.name)} loading={busy === `add:${n.name}`}>Add as new employee</Button>
                      </div>
                    )}
                    <p className="text-xs text-muted">Match lists the workers of this company, its parent and its subsidiaries, closest names first. Adding creates a worker with just the name; fill in their details later on Employees (shown as Incomplete).</p>
                  </div>
                ) : (
                  n.candidates.map((w) => (
                    <div key={w.employeeId} className="flex flex-wrap items-center gap-2">
                      <span className="hidden w-44 shrink-0 truncate text-xs text-muted sm:block" title={`Name on the certificate: ${n.name}`}>{n.name}</span>
                      {workerLine(w)}
                      {action(w)}
                    </div>
                  ))
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {data.alsoLinked.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Also linked to this policy (not matched to a name on it)</p>
          <ul className="divide-y divide-[var(--border)] rounded-md border border-default bg-surface">
            {data.alsoLinked.map((w) => (<li key={w.employeeId} className="flex flex-wrap items-center gap-2 px-3 py-2">{workerLine(w)}{action(w)}</li>))}
          </ul>
        </div>
      )}

      {canEdit && unlinked.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block w-72 max-w-full">
            <span className="mb-1 block text-xs font-medium text-muted">Link another worker to this policy</span>
            <Select value={pick} onChange={setPick} searchable placeholder="Choose a worker…" options={unlinked.map((w) => ({ value: w.employeeId, label: `${w.name} · ${w.employeeIdNo}${w.trade ? ` · ${w.trade}` : ""}${!w.own && w.company ? `: ${w.company}` : ""}` }))} />
          </label>
          <button type="button" disabled={!pick || busy !== null} onClick={() => { setLink(pick, true); setPick(""); }} className={cn("btn btn-secondary btn-sm", !pick && "opacity-50")}>Link</button>
        </div>
      )}
      <p className="text-xs text-muted">Linking files a copy of this certificate on the worker&rsquo;s profile (Documents, Insurance); unlinking takes it off again.</p>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
