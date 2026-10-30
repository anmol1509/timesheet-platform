"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { DrawerFrame } from "@/components/quick-view/DrawerFrame";
import { ChoiceField, ClickToEdit, Pill, Row, type SaveResult } from "@/components/quick-view/fields";
import { Select } from "@/components/ui/Select";
import { daysUntil } from "@/lib/compliance";
import { loadVehicleQuickViewAction, saveVehicleFieldAction, setRiderAction, type VehicleQuickView } from "./quick-view";
import { Alert } from "@/components/Alert";

export type VehicleRowInfo = { id: string; plateNumber: string; type: string | null; capacity: number | null; riders: number; routes: { id: string; name: string; time: string | null }[] };

type TabId = "overview" | "roster" | "runs";
const STATUS_OPTIONS = [{ value: "ACTIVE", label: "In service" }, { value: "MAINTENANCE", label: "Maintenance" }, { value: "INACTIVE", label: "Out of service" }];
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));

/** "Expired 4 days ago" / "17 days left" as a pill, when a date is set. */
function Due({ date }: { date: string | null }) {
  if (!date) return null;
  const d = daysUntil(new Date(date));
  return <div className="mt-1"><Pill tone={d < 0 ? "err" : d <= 30 ? "warn" : "mute"}>{d < 0 ? `Expired ${-d} day${-d === 1 ? "" : "s"} ago` : `${d} day${d === 1 ? "" : "s"} left`}</Pill></div>;
}

export function VehicleDrawer({ id, order, info, onNavigate, onClose }: { id: string; order: string[]; info: Map<string, VehicleRowInfo>; onNavigate: (id: string) => void; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<{ id: string; data: VehicleQuickView | null } | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [undo, setUndo] = useState<{ field: string; label: string; previous: string | null } | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const data = state?.id === id ? state.data : undefined;
  const row = info.get(id);

  useEffect(() => {
    let off = false;
    loadVehicleQuickViewAction(id).then((d) => { if (!off) setState({ id, data: d }); });
    return () => { off = true; };
  }, [id]);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo]);

  const reload = () => { void loadVehicleQuickViewAction(id).then((d) => setState({ id, data: d })); router.refresh(); };
  const patch = (field: string, value: string | null) => setState((s) => (s && s.id === id && s.data ? { ...s, data: { ...s.data, [field]: value } } : s));
  const save = (field: string, label: string) => async (v: string | null): Promise<SaveResult> => {
    const r = await saveVehicleFieldAction({ id, field, value: v });
    if (r.ok) { patch(field, r.value); setUndo({ field, label, previous: r.previous }); router.refresh(); }
    return r;
  };
  const doUndo = async () => {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    const r = await saveVehicleFieldAction({ id, field: u.field, value: u.previous });
    if (r.ok) { patch(u.field, r.value); router.refresh(); }
  };
  async function rider(employeeId: string, on: boolean) {
    setRosterError(null);
    const r = await setRiderAction({ vehicleId: id, employeeId, on });
    if ("error" in r) return setRosterError(r.error);
    reload();
  }

  const index = order.indexOf(id);
  const go = (delta: number) => { if (order.length > 1) onNavigate(order[(index + delta + order.length) % order.length]); };
  const capacity = data?.capacity ?? row?.capacity ?? null;
  const ridersCount = data ? data.riders.length : (row?.riders ?? 0);
  const regDays = data?.registrationExpiry ? daysUntil(new Date(data.registrationExpiry)) : null;
  const tabs = [{ id: "overview", label: "Overview" }, { id: "roster", label: "Roster", count: ridersCount }, { id: "runs", label: "Runs", count: row?.routes.length ?? 0 }];

  return (
    <DrawerFrame
      index={index}
      total={order.length}
      onStep={go}
      fullHref={`/transport/${id}`}
      fullLabel="Open full vehicle"
      title={data ? data.plateNumber : (row?.plateNumber ?? "Loading…")}
      subtitle={data ? `${data.type ?? "Type not set"}${data.capacity ? ` · ${data.capacity} seats` : ""}` : undefined}
      badge={data ? (STATUS_LABEL[data.status] ?? data.status) : undefined}
      tabs={tabs}
      tab={tab}
      onTab={(t) => setTab(t as TabId)}
      undo={undo ? { label: undo.label, onUndo: () => void doUndo() } : null}
      nextLabel="Next vehicle"
      onNext={() => go(1)}
      nextDisabled={order.length < 2}
      onClose={onClose}
    >
      {data === undefined && <div className="space-y-3" aria-busy="true">{[0, 1, 2, 3].map((n) => <div key={n} className="h-10 animate-pulse rounded-xl bg-surface-sunken" />)}</div>}
      {data === null && <p className="py-10 text-center text-sm text-muted">This vehicle couldn&apos;t be found.</p>}
      {data && !data.canEdit && <p className="mb-3 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted">You can view this vehicle but not edit it.</p>}

      {data && tab === "overview" && (
        <fieldset disabled={!data.canEdit} className="min-w-0 space-y-4">
          {regDays !== null && regDays <= 30 && (
            <p className="rounded-[14px] border border-[var(--warning-border,var(--border))] bg-[var(--warning-soft)] px-3 py-2.5 text-sm text-primary">
              <b>{regDays < 0 ? `Registration expired ${-regDays} day${-regDays === 1 ? "" : "s"} ago.` : `Registration expires in ${regDays} day${regDays === 1 ? "" : "s"}.`}</b> Enter the new date below once it is renewed.
            </p>
          )}
          {capacity !== null && capacity > 0 && (
            <div className="rounded-[14px] border border-default px-3 py-2.5 text-sm">
              <p className="text-xs text-muted">Seats used</p>
              <p className="tabular text-base font-semibold text-primary">{ridersCount}<span className="text-sm font-normal text-muted"> of {capacity}</span></p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (ridersCount / capacity) * 100)}%`, background: ridersCount > capacity ? "var(--error)" : "var(--brand-primary)" }} /></div>
            </div>
          )}
          <dl className="rounded-[14px] border border-default">
            <Row label="Driver"><ClickToEdit label="driver" value={data.driverName} onSave={save("driverName", "Driver")} /></Row>
            <Row label="Driver phone"><ClickToEdit label="driver phone" kind="phone" value={data.driverPhone} onSave={save("driverPhone", "Driver phone")} /></Row>
            <Row label="Registration"><ChoiceField kind="date" value={data.registrationExpiry} onSave={save("registrationExpiry", "Registration expiry")} /><Due date={data.registrationExpiry} /></Row>
            <Row label="Insurance"><ChoiceField kind="date" value={data.insuranceExpiry} onSave={save("insuranceExpiry", "Insurance expiry")} /><Due date={data.insuranceExpiry} /></Row>
            <Row label="Status"><ChoiceField kind="select" value={data.status} options={STATUS_OPTIONS} onSave={save("status", "Status")} placeholder="Status" /></Row>
          </dl>
        </fieldset>
      )}

      {data && tab === "roster" && (
        <fieldset disabled={!data.canEdit} className="min-w-0 space-y-3">
          <Select
            value=""
            onChange={(eid) => eid && void rider(eid, true)}
            placeholder="Add a worker to this vehicle…"
            options={data.available.map((e) => ({ value: e.id, label: `${e.name} (${e.employeeIdNo})` }))}
          />
          {rosterError && <Alert inline>{rosterError}</Alert>}
          {capacity !== null && data.riders.length > capacity && <p className="text-xs text-[var(--warning)]">More riders than seats: {data.riders.length} on {capacity} seats.</p>}
          {data.riders.length === 0 ? (
            <p className="rounded-[14px] border border-default px-3 py-6 text-center text-sm text-muted">Nobody rides this vehicle yet.</p>
          ) : (
            <ul className="rounded-[14px] border border-default text-sm">
              {data.riders.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 border-b border-default px-3 py-2 last:border-b-0">
                  <span className="min-w-0"><b className="block truncate text-primary">{r.name}</b><span className="text-xs text-muted">{r.employeeIdNo}</span></span>
                  <button type="button" onClick={() => void rider(r.id, false)} aria-label={`Take ${r.name} off this vehicle`} className="text-subtle hover:text-[var(--error)]"><X className="h-4 w-4" aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      )}

      {data && tab === "runs" && (
        <div className="space-y-3">
          {(row?.routes.length ?? 0) === 0 ? (
            <p className="rounded-[14px] border border-default px-3 py-6 text-center text-sm text-muted">No pickup runs yet. Add one under Routes.</p>
          ) : (
            <ul className="rounded-[14px] border border-default text-sm">
              {row!.routes.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 border-b border-default px-3 py-2.5 last:border-b-0">
                  <a href={`/transport/routes/${r.id}`} className="min-w-0 truncate font-medium text-primary hover:underline">{r.name}</a>
                  {r.time && <span className="tabular shrink-0 text-muted">{r.time}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </DrawerFrame>
  );
}
