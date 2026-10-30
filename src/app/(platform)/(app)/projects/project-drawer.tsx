"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DrawerFrame } from "@/components/quick-view/DrawerFrame";
import { ChoiceField, ClickToEdit, Pill, Row, type SaveResult } from "@/components/quick-view/fields";
import { PhoneField } from "@/components/ui/PhoneField";
import { daysUntil } from "@/lib/compliance";
import { cn } from "@/lib/cn";
import { loadProjectQuickViewAction, saveProjectFieldAction, saveProjectPersonAction, type ProjectPerson, type ProjectQuickView } from "./quick-view";
import { Alert } from "@/components/Alert";

/** What the list already knows about a project: the header and the figures that are read, not edited, here. */
export type ProjectRowInfo = { id: string; code: string; name: string; deployed: number; required: number | null; sites: number; openDemands: number; lpoValue: number; lpoBilled: number };

type TabId = "overview" | "team" | "missing";
const STATUS_OPTIONS = [{ value: "PLANNING", label: "Planning" }, { value: "ACTIVE", label: "Active" }, { value: "ON_HOLD", label: "On hold" }, { value: "COMPLETED", label: "Completed" }];
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));
const PEOPLE = [{ key: "manager", label: "Project manager" }, { key: "projectCoordinator", label: "Coordinator" }, { key: "salesExecutive", label: "Sales executive" }] as const;
const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`;

function gapsFor(d: ProjectQuickView) {
  return [
    { key: "manager", label: "Project manager", done: !!d.manager.name, level: "Required" as const, why: "Who the site reports to" },
    { key: "timelineStart", label: "Start date", done: !!d.timelineStart, level: "Required" as const, why: "Sets the project timeline" },
    { key: "timelineEnd", label: "End date", done: !!d.timelineEnd, level: "Required" as const, why: "Shows days left and flags overruns" },
    { key: "noOfEmployeesRequired", label: "Workers required", done: d.noOfEmployeesRequired !== null, level: "Recommended" as const, why: "Lets the project show how many are still needed" },
    { key: "address", label: "Address", done: !!d.address, level: "Recommended" as const, why: "Where the site is" },
  ];
}

export function ProjectDrawer({ id, order, people, onNavigate, onClose }: { id: string; order: string[]; people: Map<string, ProjectRowInfo>; onNavigate: (id: string) => void; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<{ id: string; data: ProjectQuickView | null } | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [undo, setUndo] = useState<{ field: string; label: string; previous: string | null } | null>(null);
  const data = state?.id === id ? state.data : undefined;
  const row = people.get(id);

  useEffect(() => {
    let off = false;
    loadProjectQuickViewAction(id).then((d) => { if (!off) setState({ id, data: d }); });
    return () => { off = true; };
  }, [id]);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo]);

  const reload = () => { void loadProjectQuickViewAction(id).then((d) => setState({ id, data: d })); router.refresh(); };
  const patch = (field: string, value: string | null) => setState((s) => (s && s.id === id && s.data ? { ...s, data: { ...s.data, [field]: field === "noOfEmployeesRequired" ? (value === null ? null : Number(value)) : value } } : s));
  const save = (field: string, label: string) => async (v: string | null): Promise<SaveResult> => {
    const r = await saveProjectFieldAction({ id, field, value: v });
    if (r.ok) { patch(field, r.value); setUndo({ field, label, previous: r.previous }); router.refresh(); }
    return r;
  };
  const doUndo = async () => {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    const r = await saveProjectFieldAction({ id, field: u.field, value: u.previous });
    if (r.ok) { patch(u.field, r.value); router.refresh(); }
  };

  const index = order.indexOf(id);
  const go = (delta: number) => { if (order.length > 1) onNavigate(order[(index + delta + order.length) % order.length]); };
  const gaps = useMemo(() => (data ? gapsFor(data) : []), [data]);
  const open = gaps.filter((g) => !g.done);
  const pct = gaps.length ? Math.round(((gaps.length - open.length) / gaps.length) * 100) : 100;
  const tabs = [{ id: "overview", label: "Overview" }, { id: "team", label: "Team" }, { id: "missing", label: "Missing", count: open.length }];
  const required = data?.noOfEmployeesRequired ?? row?.required ?? null;
  const daysLeft = data?.timelineEnd ? daysUntil(new Date(data.timelineEnd)) : null;

  return (
    <DrawerFrame
      index={index}
      total={order.length}
      onStep={go}
      fullHref={`/projects/${id}`}
      fullLabel="Open full project"
      title={data ? data.name : (row?.name ?? "Loading…")}
      subtitle={data ? `${data.code} · ${data.clientName}` : row?.code}
      badge={data ? (STATUS_LABEL[data.status] ?? data.status) : undefined}
      tabs={tabs}
      tab={tab}
      onTab={(t) => setTab(t as TabId)}
      undo={undo ? { label: undo.label, onUndo: () => void doUndo() } : null}
      nextLabel="Next project"
      onNext={() => go(1)}
      nextDisabled={order.length < 2}
      onClose={onClose}
    >
      {data === undefined && <div className="space-y-3" aria-busy="true">{[0, 1, 2, 3].map((n) => <div key={n} className="h-10 animate-pulse rounded-xl bg-surface-sunken" />)}</div>}
      {data === null && <p className="py-10 text-center text-sm text-muted">This project couldn&apos;t be found.</p>}
      {data && !data.canEdit && <p className="mb-3 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted">You can view this project but not edit it.</p>}

      {data && tab === "overview" && (
        <fieldset disabled={!data.canEdit} className="min-w-0 space-y-4">
          {row && (
            <div className="grid grid-cols-2 gap-2.5 text-sm">
              <div className="rounded-[14px] border border-default px-3 py-2.5">
                <p className="text-xs text-muted">Workers deployed</p>
                <p className="tabular text-base font-semibold text-primary">{row.deployed}{required !== null && <span className="text-sm font-normal text-muted"> of {required}</span>}</p>
                {required !== null && required > 0 && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken"><div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${Math.min(100, (row.deployed / required) * 100)}%` }} /></div>}
              </div>
              <div className="rounded-[14px] border border-default px-3 py-2.5">
                <p className="text-xs text-muted">Billed on LPOs</p>
                <p className="tabular text-base font-semibold text-primary">{row.lpoValue > 0 ? `${Math.round((row.lpoBilled / row.lpoValue) * 100)}%` : "—"}</p>
                {row.lpoValue > 0 && <p className="text-[11px] text-muted">{aed(row.lpoBilled)} of {aed(row.lpoValue)}</p>}
              </div>
            </div>
          )}
          <dl className="rounded-[14px] border border-default">
            <Row label="Status"><ChoiceField kind="select" value={data.status} options={STATUS_OPTIONS} onSave={save("status", "Status")} placeholder="Status" /></Row>
            <Row label="Starts"><ChoiceField kind="date" value={data.timelineStart} onSave={save("timelineStart", "Start date")} /></Row>
            <Row label="Ends">
              <ChoiceField kind="date" value={data.timelineEnd} onSave={save("timelineEnd", "End date")} />
              {daysLeft !== null && data.status !== "COMPLETED" && <div className="mt-1"><Pill tone={daysLeft < 0 ? "err" : daysLeft <= 30 ? "warn" : "mute"}>{daysLeft < 0 ? `${-daysLeft}d past the end date` : `${daysLeft}d left`}</Pill></div>}
            </Row>
            <Row label="Workers needed"><ClickToEdit label="workers required" value={data.noOfEmployeesRequired === null ? null : String(data.noOfEmployeesRequired)} onSave={save("noOfEmployeesRequired", "Workers required")} /></Row>
            <Row label="Address"><ClickToEdit label="address" value={data.address} onSave={save("address", "Address")} /></Row>
          </dl>
          {row && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <Link href={`/projects/${id}`} className="text-[var(--brand-primary)] hover:underline">{row.sites} site{row.sites === 1 ? "" : "s"}</Link>
              {row.openDemands > 0 && <Link href="/demand" className="text-[var(--brand-primary)] hover:underline">{row.openDemands} open demand{row.openDemands === 1 ? "" : "s"}</Link>}
            </div>
          )}
        </fieldset>
      )}

      {data && tab === "team" && (
        <fieldset disabled={!data.canEdit} className="min-w-0 space-y-3">
          <p className="text-xs text-muted">A named person needs a phone number. Clearing the name clears the contact.</p>
          <div className="rounded-[14px] border border-default">
            {PEOPLE.map((p) => <PersonRow key={`${p.key}-${data[p.key].name}-${data[p.key].phone}`} projectId={id} person={p.key} label={p.label} value={data[p.key]} onSaved={reload} />)}
          </div>
        </fieldset>
      )}

      {data && tab === "missing" && (
        <fieldset disabled={!data.canEdit} className="min-w-0 space-y-3">
          <div className="flex items-center gap-3 rounded-[14px] border border-default bg-brand-soft px-3 py-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--brand-primary) 0 ${pct}%, var(--border) ${pct}% 100%)` }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-[11px] font-bold">{pct}%</span>
            </div>
            <p className="text-sm"><b>{gaps.length - open.length} of {gaps.length} project items done.</b><br /><span className="text-xs text-muted">{open.length ? "Fill the gaps below without leaving this panel." : "Nothing is missing."}</span></p>
          </div>
          {open.length > 0 && (
            <div className="rounded-[14px] border border-default">
              {open.map((g) => (
                <div key={g.key} className="border-b border-default px-3 py-3 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-2"><b className="text-sm font-semibold text-primary">{g.label}</b><Pill tone={g.level === "Required" ? "err" : "warn"}>{g.level}</Pill></div>
                  <p className="mt-0.5 mb-2 text-[11px] text-muted">{g.why}</p>
                  {g.key === "manager" ? (
                    <PersonRow projectId={id} person="manager" label="Project manager" value={data.manager} onSaved={reload} bare />
                  ) : g.key === "timelineStart" || g.key === "timelineEnd" ? (
                    <ChoiceField kind="date" value={null} onSave={save(g.key, g.label)} />
                  ) : (
                    <ClickToEdit label={g.label.toLowerCase()} value={null} placeholder={`Add ${g.label.toLowerCase()}`} onSave={save(g.key, g.label)} />
                  )}
                </div>
              ))}
            </div>
          )}
          {gaps.some((g) => g.done) && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-primary">Already done</h3>
              <p className="rounded-[14px] border border-default px-3 py-2.5 text-sm text-muted">{gaps.filter((g) => g.done).map((g) => `✓ ${g.label}`).join(" · ")}</p>
            </div>
          )}
        </fieldset>
      )}
    </DrawerFrame>
  );
}

/** One named contact: shown as a line, opened to edit name, phone and email together because the phone is required with the name. */
function PersonRow({ projectId, person, label, value, onSaved, bare }: { projectId: string; person: string; label: string; value: ProjectPerson; onSaved: () => void; bare?: boolean }) {
  const [editing, setEditing] = useState(!!bare);
  const [name, setName] = useState(value.name ?? "");
  const [phone, setPhone] = useState(value.phone ?? "");
  const [email, setEmail] = useState(value.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await saveProjectPersonAction({ id: projectId, person, name: name.trim(), phone: phone.trim(), email: email.trim() }).catch(() => ({ error: "That didn't save. Please try again." }));
    setBusy(false);
    if ("error" in r) return setError(r.error);
    if (!bare) setEditing(false);
    onSaved();
  }

  const shell = (children: React.ReactNode) => (bare ? <div>{children}</div> : <div className="border-b border-default px-3 py-2.5 last:border-b-0">{children}</div>);
  if (!editing) {
    return shell(
      <button type="button" aria-label={`Edit ${label.toLowerCase()}`} onClick={() => setEditing(true)} className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-1 text-left text-sm hover:border-default hover:bg-surface-hover">
        <span className="text-muted">{label}</span>
        <span className="min-w-0 truncate text-right font-medium text-primary">{value.name ? `${value.name}${value.phone ? ` · ${value.phone}` : ""}` : <span className="font-normal text-subtle">Add</span>}</span>
      </button>
    );
  }
  return shell(
    <form data-editing onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-2">
      {!bare && <p className="text-xs font-medium text-muted">{label}</p>}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label={`${label} name`} className="input w-full" autoFocus={!bare} />
      <PhoneField value={phone} onChange={setPhone} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" aria-label={`${label} email`} className={cn("input w-full")} />
      {error && <Alert inline>{error}</Alert>}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Save</button>
        {!bare && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setError(null); }}>Cancel</button>}
      </div>
    </form>
  );
}
