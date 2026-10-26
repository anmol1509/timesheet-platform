"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { getWorkmenCompWorkersAction, saveInsuredNamesAction, setWorkmenCompLinkAction, type WcWorker, type WcWorkers } from "../actions";

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

  if (error && !data) return <p role="alert" className="px-4 py-3 text-sm text-error">{error}</p>;
  if (!data) return <p className="flex items-center gap-1.5 px-4 py-3 text-sm text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>;

  const named = data.names ?? [];
  const linkedHere = data.roster.filter((w) => w.linkedTo === "this").length;
  const notOnRoster = named.filter((n) => n.candidates.length === 0).length;
  const unlinked = data.roster.filter((w) => w.linkedTo === null);

  const action = (w: WcWorker) => {
    if (!canEdit) return null;
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
      {state(w)}
    </span>
  );

  return (
    <div className="space-y-3 border-t border-default bg-surface-subtle px-4 py-3">
      {data.names === null ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
          <span>The names on this certificate were not kept when it was uploaded.</span>
          {canEdit && <button type="button" disabled={reading} onClick={readAgain} className="btn btn-secondary btn-sm">{reading ? "Reading…" : "Read the names from the file"}</button>}
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
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-primary">{n.name}</span>
                    <Badge color="red">Not on this company&rsquo;s roster</Badge>
                    {n.suggestions.length === 0 && <span className="text-xs text-muted">Add them from Employees &amp; insurance, or pick the right worker below if the name is spelled differently.</span>}
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
            <Select value={pick} onChange={setPick} searchable placeholder="Choose a worker…" options={unlinked.map((w) => ({ value: w.employeeId, label: `${w.name} · ${w.employeeIdNo}` }))} />
          </label>
          <button type="button" disabled={!pick || busy !== null} onClick={() => { setLink(pick, true); setPick(""); }} className={cn("btn btn-secondary btn-sm", !pick && "opacity-50")}>Link</button>
        </div>
      )}
      <p className="text-xs text-muted">Linking files a copy of this certificate on the worker&rsquo;s profile (Documents, Insurance); unlinking takes it off again.</p>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </div>
  );
}
