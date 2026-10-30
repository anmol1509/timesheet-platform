"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { DrawerFrame } from "@/components/quick-view/DrawerFrame";
import { ChoiceField, ClickToEdit, Pill, Row, type SaveResult } from "@/components/quick-view/fields";
import { NumberInput } from "@/components/ui/NumberInput";
import { cn } from "@/lib/cn";
import { setTradeApprovalAction } from "./actions";
import { loadDemandQuickViewAction, saveDemandFieldAction, type DemandQuickView } from "./quick-view";
import { Alert } from "@/components/Alert";

export type DemandPerson = { id: string; requestNo: number; clientName: string; projectName: string };

type TabId = "overview" | "todo";
const age = (d: number) => (d <= 0 ? "today" : d === 1 ? "1 day" : `${d} days`);
const OFFER_TONE = { SENT: "warn", ACCEPTED: "ok", DECLINED: "err" } as const;
const STATUS_TONE: Record<string, string> = { Open: "Open", Approved: "Approved", Rejected: "Rejected", Closed: "Closed" };

/** Where a request is: 0 waiting for a decision, 1 approved and waiting for workers, 2 filled. */
function stage(d: DemandQuickView) {
  // "Approved" counts once every trade has been decided; until then the request is still waiting on approval.
  const decided = d.trades.length > 0 && d.trades.every((t) => t.approvedQuantity !== null);
  const target = d.trades.reduce((n, t) => n + (t.approvedQuantity ?? 0), 0);
  const allocated = d.trades.reduce((n, t) => n + t.allocated, 0);
  const index = !decided || target === 0 ? 0 : allocated >= target ? 2 : 1;
  return { index, target, allocated, requested: d.trades.reduce((n, t) => n + t.quantity, 0) };
}

export function DemandDrawer({ id, order, people, onNavigate, onClose }: { id: string; order: string[]; people: Map<string, DemandPerson>; onNavigate: (id: string) => void; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<{ id: string; data: DemandQuickView | null } | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [undo, setUndo] = useState<{ field: string; label: string; previous: string | null } | null>(null);
  const data = state?.id === id ? state.data : undefined;
  const row = people.get(id);

  useEffect(() => {
    let off = false;
    loadDemandQuickViewAction(id).then((d) => { if (!off) setState({ id, data: d }); });
    return () => { off = true; };
  }, [id]);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo]);

  const reload = () => { void loadDemandQuickViewAction(id).then((d) => setState({ id, data: d })); router.refresh(); };
  const patch = (field: string, value: string | null) => setState((s) => (s && s.id === id && s.data ? { ...s, data: { ...s.data, [field]: value } } : s));
  const save = (field: string, label: string) => async (v: string | null): Promise<SaveResult> => {
    const r = await saveDemandFieldAction({ id, field, value: v });
    if (r.ok) { patch(field, r.value); setUndo({ field, label, previous: r.previous }); router.refresh(); }
    return r;
  };
  const doUndo = async () => {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    const r = await saveDemandFieldAction({ id, field: u.field, value: u.previous });
    if (r.ok) { patch(u.field, r.value); router.refresh(); }
  };

  const index = order.indexOf(id);
  const go = (delta: number) => { if (order.length > 1) onNavigate(order[(index + delta + order.length) % order.length]); };
  const st = useMemo(() => (data ? stage(data) : null), [data]);
  const todo = useMemo(() => {
    if (!data) return { undecided: [] as DemandQuickView["trades"], short: [] as DemandQuickView["trades"], noOffers: false };
    return {
      undecided: data.trades.filter((t) => t.approvedQuantity === null),
      short: data.trades.filter((t) => t.approvedQuantity !== null && t.allocated < t.approvedQuantity),
      noOffers: data.offers.length === 0 && data.trades.some((t) => (t.approvedQuantity ?? 0) > 0),
    };
  }, [data]);
  const todoCount = todo.undecided.length + todo.short.length + (todo.noOffers ? 1 : 0);
  const tabs = [{ id: "overview", label: "Overview" }, { id: "todo", label: "To do", count: data && data.status !== "Rejected" && data.status !== "Closed" ? todoCount : 0 }];

  return (
    <DrawerFrame
      index={index}
      total={order.length}
      onStep={go}
      fullHref={`/demand/${id}`}
      fullLabel="Open full request"
      title={data ? `Request #${data.requestNo}` : row ? `Request #${row.requestNo}` : "Loading…"}
      subtitle={data ? `${data.clientName} · ${data.projectName}` : row ? `${row.clientName} · ${row.projectName}` : undefined}
      badge={data ? (STATUS_TONE[data.status] ?? data.status) : undefined}
      tabs={tabs}
      tab={tab}
      onTab={(t) => setTab(t as TabId)}
      undo={undo ? { label: undo.label, onUndo: () => void doUndo() } : null}
      nextLabel="Next request"
      onNext={() => go(1)}
      nextDisabled={order.length < 2}
      onClose={onClose}
    >
      {data === undefined && <div className="space-y-3" aria-busy="true">{[0, 1, 2, 3].map((n) => <div key={n} className="h-10 animate-pulse rounded-xl bg-surface-sunken" />)}</div>}
      {data === null && <p className="py-10 text-center text-sm text-muted">This request couldn&apos;t be found.</p>}

      {data && st && (
        <>
          <ol className="mb-4 flex items-center text-xs" aria-label="Progress">
            {["Requested", data.status === "Rejected" ? "Rejected" : "Approved", "Allocated"].map((label, n) => {
              const reached = data.status === "Rejected" ? n === 0 : n <= st.index || (n === 1 && st.index >= 1);
              const current = data.status !== "Rejected" && n === Math.min(st.index + 1, 2) && st.index < 2;
              return (
                <li key={label} className={cn("flex items-center gap-2", n < 2 && "flex-1")}>
                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", data.status === "Rejected" && n === 1 ? "bg-[var(--error)] text-white" : n === 0 || reached ? "bg-[var(--success)] text-white" : current ? "bg-[var(--brand-primary)] text-white" : "bg-surface-sunken text-muted")}>
                    {n === 0 || reached ? <Check className="h-3 w-3" aria-hidden /> : n + 1}
                  </span>
                  <span className={cn(current ? "font-semibold text-primary" : "text-muted")}>{label}</span>
                  {n < 2 && <span className={cn("h-px flex-1", reached && n < 2 ? "bg-[var(--success)]" : "bg-[var(--border)]")} aria-hidden />}
                </li>
              );
            })}
          </ol>

          {tab === "overview" && (
            <fieldset disabled={!data.canEdit} className="min-w-0 space-y-4">
              <dl className="rounded-[14px] border border-default">
                <Row label="Raised">{<span className="block py-1 font-medium text-primary">{age(data.ageDays)} ago · {data.requestType}</span>}</Row>
                <Row label="Priority"><ChoiceField kind="select" value={data.priority} options={[{ value: "High", label: "High" }, { value: "Medium", label: "Medium" }, { value: "Low", label: "Low" }]} onSave={save("priority", "Priority")} placeholder="Not set" /></Row>
                <Row label="Remarks"><ClickToEdit label="remarks" value={data.remarks} onSave={save("remarks", "Remarks")} /></Row>
              </dl>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-primary">Trades <span className="font-normal text-muted">· {st.requested} requested{st.target > 0 && `, ${st.target} approved, ${st.allocated} allocated`}</span></h3>
                <ul className="rounded-[14px] border border-default text-sm">
                  {data.trades.map((t) => (
                    <TradeRow key={t.id} trade={t} canApprove={data.canApprove && data.status !== "Rejected" && data.status !== "Closed"} onChanged={reload} />
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-primary">Supplier offers</h3>
                {data.offers.length === 0 ? (
                  <p className="rounded-[14px] border border-default px-3 py-2.5 text-sm text-muted">No offers sent yet.</p>
                ) : (
                  <ul className="rounded-[14px] border border-default text-sm">
                    {data.offers.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 border-b border-default px-3 py-2 last:border-b-0">
                        <span className="min-w-0 truncate font-medium text-primary">{o.supplierName}</span>
                        <Pill tone={OFFER_TONE[o.status as keyof typeof OFFER_TONE] ?? "mute"}>{o.status.charAt(0) + o.status.slice(1).toLowerCase()}</Pill>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </fieldset>
          )}

          {tab === "todo" && (
            <div className="space-y-3">
              {data.status === "Rejected" || data.status === "Closed" ? (
                <p className="rounded-[14px] border border-default px-3 py-4 text-center text-sm text-muted">This request is {data.status.toLowerCase()}, so nothing is left to do.</p>
              ) : todoCount === 0 ? (
                <p className="rounded-[14px] border border-default px-3 py-4 text-center text-sm text-muted">Nothing left to do on this request.</p>
              ) : (
                <ul className="rounded-[14px] border border-default text-sm">
                  {todo.undecided.map((t) => (
                    <li key={`u-${t.id}`} className="border-b border-default last:border-b-0">
                      <p className="px-3 pt-2.5 text-xs text-muted">Needs a decision</p>
                      <TradeRow trade={t} canApprove={data.canApprove} onChanged={reload} bare />
                    </li>
                  ))}
                  {todo.short.map((t) => (
                    <li key={`s-${t.id}`} className="flex items-center justify-between gap-3 border-b border-default px-3 py-2.5 last:border-b-0">
                      <span><b className="text-primary">{t.trade}</b><span className="block text-xs text-muted">{t.allocated} of {t.approvedQuantity} workers allocated</span></span>
                      <Link href={`/demand/${id}/mobilise`} className="btn btn-secondary btn-sm shrink-0">Allocate</Link>
                    </li>
                  ))}
                  {todo.noOffers && (
                    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span><b className="text-primary">No supplier offers sent</b><span className="block text-xs text-muted">Ask suppliers who can fill the approved trades.</span></span>
                      <Link href={`/demand/${id}`} className="btn btn-secondary btn-sm shrink-0">Open</Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </DrawerFrame>
  );
}

/** One trade: how many were asked for, approved and allocated, with the approval decision made right here. */
function TradeRow({ trade, canApprove, onChanged, bare }: { trade: DemandQuickView["trades"][number]; canApprove: boolean; onChanged: () => void; bare?: boolean }) {
  const [qty, setQty] = useState<number | "">(trade.approvedQuantity ?? trade.quantity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const undecided = trade.approvedQuantity === null;

  async function decide(value: number | "") {
    setBusy(true);
    setError(null);
    const f = new FormData();
    f.set("tradeId", trade.id);
    f.set("approvedQuantity", value === "" ? "" : String(value));
    const r = await setTradeApprovalAction(f).catch(() => ({ error: "That didn't save. Please try again." }));
    setBusy(false);
    if (r && "error" in r && r.error) return setError(r.error);
    onChanged();
  }

  return (
    <div className={cn(!bare && "border-b border-default last:border-b-0", "px-3 py-2.5")}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0"><b className="text-primary">{trade.trade}</b><span className="block text-xs text-muted">{trade.quantity} requested{!undecided && ` · ${trade.approvedQuantity} approved · ${trade.allocated} allocated`}</span></span>
        {undecided ? <Pill tone="warn">Undecided</Pill> : <Pill tone={trade.allocated >= (trade.approvedQuantity ?? 0) && trade.allocated > 0 ? "ok" : "mute"}>{trade.allocated}/{trade.approvedQuantity}</Pill>}
      </div>
      {canApprove && (
        <div className="mt-2 flex items-center gap-2">
          <div className="w-28"><NumberInput value={qty} onChange={setQty} min={0} max={trade.quantity} ariaLabel={`Approved quantity for ${trade.trade}`} /></div>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || qty === "" || qty === trade.approvedQuantity} onClick={() => void decide(qty)}>{undecided ? "Approve" : "Update"}</button>
          {!undecided && <button type="button" className="text-xs font-medium text-[var(--error)] hover:underline" disabled={busy} onClick={() => void decide("")}>Undo decision</button>}
        </div>
      )}
      {error && <Alert inline className="mt-1">{error}</Alert>}
    </div>
  );
}
