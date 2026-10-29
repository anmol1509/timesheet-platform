"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, Search } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { RATE_TYPES } from "@/lib/trades";
import { approvalStateOf, approvedHeadcount } from "@/lib/demandApproval";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/cn";
import {
  allocateEmployeesAction,
  changeEmployeeTradeAction,
  unallocateEmployeeAction,
} from "../../actions";
import { DatePicker } from "@/components/ui/DatePicker";
import { HeldSuppliersList } from "@/components/HeldSuppliers";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";

type Line = {
  id: string;
  trade: string;
  /** Heads agreed of `quantity`; null while undecided. The cap on this line. */
  approvedQuantity: number | null;
  quantity: number;
  shift: string | null;
  assigned: { id: string; employeeId: string; name: string; employeeIdNo: string; status: string }[];
};

type Worker = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  /** Trades from the taxonomy join, checked alongside the `trade` string. */
  skillNames: string[];
  supplierId: string | null;
  supplierName: string | null;
  /** Set when the worker can't be mobilised yet: the reason, e.g. their supplier isn't approved. */
  blocked: string | null;
};

function sameTrade(a: string | null | undefined, b: string) {
  if (!a) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function holdsTrade(worker: Worker, trade: string) {
  return (
    sameTrade(worker.trade, trade) || worker.skillNames.some((n) => sameTrade(n, trade))
  );
}

/**
 * Mobilisation: put names against an accepted demand's trade lines.
 *
 * The view screen deliberately shows only counts — whether a line *can* be
 * covered. This is where the actual workers are chosen, which is why it lists
 * them by name.
 *
 * The second tab exists because the roster rarely matches a demand exactly: a
 * client asks for Carpenters and the bench holds Helpers. Re-designating a
 * worker is what happens in practice, so it's done here, and it writes the
 * worker's profile rather than being a per-demand fudge.
 */
export function MobilisationBoard({
  lines,
  workers,
  canApproveSuppliers,
}: {
  lines: Line[];
  workers: Worker[];
  canApproveSuppliers: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeLineId, setActiveLineId] = useState(lines[0]?.id ?? "");
  const [tab, setTab] = useState<"matching" | "other">("matching");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // The worker being switched to this line's trade, and the pay asked for when they are.
  const [retrade, setRetrade] = useState<string | null>(null);
  const [pay, setPay] = useState<{ rateType: string; rate: string }>({ rateType: "", rate: "" });
  const [query, setQuery] = useState("");
  // When the worker is due on site. Recorded per mobilisation, and what moves
  // them from idle to under-mobilisation.
  const [mobilisationDate, setMobilisationDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  // One worker mobilised from their own row, with their own date.
  const [one, setOne] = useState<Worker | null>(null);

  const activeLine = lines.find((l) => l.id === activeLineId) ?? lines[0];
  const assignedIds = useMemo(
    () => new Set(lines.flatMap((l) => l.assigned.map((a) => a.employeeId))),
    [lines]
  );

  const available = useMemo(
    () => workers.filter((w) => !assignedIds.has(w.id)),
    [workers, assignedIds]
  );

  const matching = useMemo(
    () => (activeLine ? available.filter((w) => holdsTrade(w, activeLine.trade)) : []),
    [available, activeLine]
  );
  const others = useMemo(
    () => (activeLine ? available.filter((w) => !holdsTrade(w, activeLine.trade)) : []),
    [available, activeLine]
  );

  // Idle workers held back because their supplier isn't approved, one row per supplier, with how many hold this line's trade.
  const held = useMemo(() => {
    const by = new Map<string, { id: string; name: string; workers: number; detail: string; ofTrade: number }>();
    for (const w of available) {
      if (!w.blocked || !w.supplierId) continue;
      const cur = by.get(w.supplierId) ?? { id: w.supplierId, name: w.supplierName ?? "Supplier", workers: 0, detail: w.blocked, ofTrade: 0 };
      cur.workers++;
      if (activeLine && holdsTrade(w, activeLine.trade)) cur.ofTrade++;
      by.set(w.supplierId, cur);
    }
    return [...by.values()]
      .sort((a, b) => b.ofTrade - a.ofTrade || b.workers - a.workers)
      .map((h) => ({ id: h.id, name: h.name, workers: h.workers, detail: h.detail, needs: h.ofTrade > 0 && activeLine ? [`${h.ofTrade} of them ${h.ofTrade === 1 ? "is" : "are"} ${activeLine.trade}`] : [] }));
  }, [available, activeLine]);

  const q = query.trim().toLowerCase();
  const found = (w: Worker) => !q || [w.name, w.employeeIdNo, w.trade ?? "", ...w.skillNames].some((v) => v.toLowerCase().includes(q));
  const shownMatching = matching.filter(found);
  const shownOthers = others.filter(found);

  if (!activeLine) {
    return (
      <p className="card p-6 text-center text-sm text-muted">
        This demand has no trade lines to mobilise against.
      </p>
    );
  }

  // Measured against what was agreed, not what was asked for: a line cut from
  // ten to six is full at six.
  const approved = approvedHeadcount(activeLine);
  const remaining = Math.max(0, approved - activeLine.assigned.length);
  const locked = approved === 0;

  function toggle(id: string) {
    if (workers.find((w) => w.id === id)?.blocked) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < remaining) next.add(id);
      return next;
    });
  }

  function assign() {
    if (picked.size === 0) return;
    const body = new FormData();
    body.append("tradeId", activeLine.id);
    body.append("mobilisationDate", mobilisationDate);
    for (const id of picked) body.append("employeeId", id);
    startTransition(async () => {
      await allocateEmployeesAction(body);
      setPicked(new Set());
      router.refresh();
    });
  }

  function assignOne(w: Worker, date: string) {
    const body = new FormData();
    body.append("tradeId", activeLine.id);
    body.append("mobilisationDate", date);
    body.append("employeeId", w.id);
    startTransition(async () => {
      await allocateEmployeesAction(body);
      setOne(null);
      setPicked((prev) => { const next = new Set(prev); next.delete(w.id); return next; });
      router.refresh();
    });
  }

  function unassign(allocationId: string) {
    const body = new FormData();
    body.append("allocationId", allocationId);
    startTransition(async () => {
      await unallocateEmployeeAction(body);
      router.refresh();
    });
  }

  function applyRetrade(employeeId: string) {
    if (!activeLine || !pay.rateType || pay.rate === "") return;
    const body = new FormData();
    body.append("employeeId", employeeId);
    body.append("trade", activeLine.trade);
    body.append("rateType", pay.rateType);
    body.append("rate", pay.rate);
    startTransition(async () => {
      await changeEmployeeTradeAction(body);
      setRetrade(null);
      setPay({ rateType: "", rate: "" });
      router.refresh();
    });
  }

  const heldWorkers = held.reduce((n, h) => n + h.workers, 0);
  return (
    <div className="space-y-4">
    <HeldSuppliersList
      rows={held}
      canApprove={canApproveSuppliers}
      heading={`${heldWorkers} idle worker${heldWorkers === 1 ? "" : "s"} can't be picked: ${held.length === 1 ? "their supplier isn't" : `${held.length} suppliers aren't`} approved yet.`}
    />
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[18rem_1fr]">
      {/* Which line is being filled. */}
      <div className="space-y-2">
        {lines.map((line) => {
          const done = approvedHeadcount(line) > 0 && line.assigned.length >= approvedHeadcount(line);
          return (
            <button
              key={line.id}
              type="button"
              onClick={() => {
                setActiveLineId(line.id);
                setPicked(new Set());
              }}
              className={cn(
                "w-full rounded-card border p-3 text-left transition",
                line.id === activeLine.id
                  ? "border-[var(--brand-primary)] bg-brand-soft"
                  : "border-default bg-surface hover:bg-surface-hover"
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium text-primary">{line.trade}</span>
                {done && <Check className="h-4 w-4 text-[var(--success)]" aria-hidden />}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {approvalStateOf(line) === "PENDING" ? "Not approved · " : ""}
                {approvalStateOf(line) === "REFUSED" ? "Refused · " : ""}
                {line.shift ? `${line.shift} shift · ` : ""}
                <span className="tabular">
                  {line.assigned.length}/{approvedHeadcount(line) || line.quantity}
                </span>{" "}
                assigned
                {approvalStateOf(line) === "PARTIAL" && (
                  <span className="tabular"> · {approvedHeadcount(line)} of {line.quantity} approved</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {activeLine.assigned.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              Mobilised for {activeLine.trade}
            </h3>
            <ul className="divide-y divide-[var(--border)]">
              {activeLine.assigned.map((a) => {
                // Once Site Arrival has confirmed them (ON_SITE) or attendance
                // has (ACTIVE), removing them here would silently strand a
                // worker who's actually on site with no allocation behind
                // them — that has to go through Demobilisation instead, which
                // closes the placement properly.
                const confirmed = a.status !== "UNDER_MOBILISATION";
                return (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <Link
                      href={`/employees/${a.employeeId}`} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {a.name}
                      <span className="tabular ml-2 text-xs text-subtle">
                        {a.employeeIdNo}
                      </span>
                    </Link>
                    {confirmed ? (
                      <Badge color="green">Confirmed on site</Badge>
                    ) : (
                      <button
                        type="button"
                        disabled={locked || pending}
                        onClick={() => unassign(a.id)}
                        className="text-xs font-medium text-[var(--error)] hover:underline disabled:opacity-60"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-default px-4 py-3">
            <div className="flex gap-1">
              {(
                [
                  ["matching", `${activeLine.trade} (${matching.length})`],
                  ["other", `Other trades (${others.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "rounded-control px-3 py-1.5 text-xs font-medium transition",
                    tab === key
                      ? "bg-brand-soft text-[var(--brand-primary)]"
                      : "text-secondary hover:bg-surface-hover"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">
                {locked
                  ? approvalStateOf(activeLine) === "REFUSED"
                    ? "This line was refused"
                    : "Approve this trade to mobilise"
                  : remaining === 0
                    ? "Line is full"
                    : picked.size === 0
                      ? `${remaining} still needed. Use the button on a row, or tick several to mobilise them together.`
                      : `${picked.size} selected, one date for all`}
              </span>
              {picked.size > 0 && (
                <>
                  <label className="flex items-center gap-1.5">
                    <span className="text-xs text-muted">On site from</span>
                    <DatePicker value={mobilisationDate} onChange={(v) => setMobilisationDate(v)} disabled={locked} />
                  </label>
                  <button
                    type="button"
                    onClick={assign}
                    disabled={locked || pending}
                    className="btn btn-primary btn-sm"
                  >
                    Mobilise {picked.size}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="relative border-b border-default px-4 py-2">
            <Search className="pointer-events-none absolute top-1/2 left-7 h-3.5 w-3.5 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, ID or trade"
              aria-label="Search workers"
              className="input w-full pl-8"
            />
          </div>

          {tab === "matching" ? (
            shownMatching.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                {q ? (
                  <>No {activeLine.trade} worker matches &ldquo;{query.trim()}&rdquo;.</>
                ) : (
                  <>
                    No idle worker holds {activeLine.trade}. Use{" "}
                    <span className="font-medium">Other trades</span> to re-designate
                    someone.
                  </>
                )}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {shownMatching.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Checkbox
                      checked={picked.has(w.id)}
                      onCheckedChange={() => toggle(w.id)}
                      disabled={locked || !!w.blocked || (!picked.has(w.id) && picked.size >= remaining)}
                    />
                    <div className="min-w-0 flex-1">
                      <Link href={`/employees/${w.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                        {w.name}
                        <span className="tabular ml-2 text-xs text-subtle">
                          {w.employeeIdNo}
                        </span>
                      </Link>
                      <Blocked worker={w} />
                    </div>
                    <span className="text-xs text-muted">{w.trade || "No trade set"}</span>
                    <button
                      type="button"
                      onClick={() => setOne(w)}
                      disabled={locked || pending || !!w.blocked || remaining === 0}
                      className="btn btn-secondary btn-sm shrink-0"
                    >
                      Mobilise
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {shownOthers.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/employees/${w.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                      {w.name}
                      <span className="tabular ml-2 text-xs text-subtle">
                        {w.employeeIdNo}
                      </span>
                    </Link>
                    <Blocked worker={w} />
                  </div>
                  <span className="text-xs text-muted">{w.trade || "No trade set"}</span>
                  {retrade === w.id ? (
                    <div className="flex w-full flex-wrap items-end gap-2 border-t border-default pt-2.5">
                      <span className="mr-auto text-xs text-muted">
                        Switch to <span className="font-medium text-primary">{activeLine?.trade}</span>. How are they paid?
                      </span>
                      <label className="w-36">
                        <span className="mb-1 block text-xs font-medium text-muted">Pay type</span>
                        <Select
                          value={pay.rateType}
                          onChange={(v) => setPay((p) => ({ ...p, rateType: v }))}
                          placeholder="Hourly or fixed"
                          searchable={false}
                          options={RATE_TYPES.map((r) => ({ value: r.value, label: r.label }))}
                        />
                      </label>
                      <label className="w-32">
                        <span className="mb-1 block text-xs font-medium text-muted">Rate (AED)</span>
                        <NumberInput value={pay.rate} onChange={(v) => setPay((p) => ({ ...p, rate: String(v) }))} min={0} step={0.01} placeholder={pay.rateType === "FIXED" ? "Per month" : "Per hour"} className="w-full" />
                      </label>
                      <button type="button" disabled={locked || pending || !pay.rateType || pay.rate === ""} onClick={() => applyRetrade(w.id)} className="btn btn-primary btn-sm">
                        Switch trade
                      </button>
                      <button type="button" onClick={() => setRetrade(null)} className="btn btn-secondary btn-sm">Cancel</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={locked || pending}
                      onClick={() => { setRetrade(w.id); setPay({ rateType: "", rate: "" }); }}
                      title="Updates the worker's profile, not just this demand"
                      className="btn btn-secondary btn-sm shrink-0"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
                      Switch to {activeLine?.trade}
                    </button>
                  )}
                </li>
              ))}
              {shownOthers.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-muted">
                  {q ? <>No other worker matches &ldquo;{query.trim()}&rdquo;.</> : "No other idle workers available."}
                </p>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
    <MobiliseOneModal worker={one} trade={activeLine.trade} pending={pending} onClose={() => setOne(null)} onConfirm={assignOne} />
    </div>
  );
}

function MobiliseOneModal({ worker, trade, pending, onClose, onConfirm }: { worker: Worker | null; trade: string; pending: boolean; onClose: () => void; onConfirm: (w: Worker, date: string) => void }) {
  return (
    <Dialog open={!!worker} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Mobilise" description={worker ? `${worker.name} (${worker.employeeIdNo}) as ${trade}` : undefined}>
        {worker && <MobiliseOneForm key={worker.id} worker={worker} pending={pending} onClose={onClose} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  );
}

function MobiliseOneForm({ worker, pending, onClose, onConfirm }: { worker: Worker; pending: boolean; onClose: () => void; onConfirm: (w: Worker, date: string) => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <div className="mt-4 space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">On site from</span>
        <DatePicker value={date} onChange={(v) => setDate(v)} className="w-full" />
      </label>
      <DialogFooter>
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="button" disabled={pending || !date} onClick={() => onConfirm(worker, date)} className="btn btn-primary">{pending ? "Mobilising…" : "Mobilise"}</button>
      </DialogFooter>
    </div>
  );
}

/** Why a worker can't be picked yet, with the way to fix it. */
function Blocked({ worker }: { worker: Worker }) {
  if (!worker.blocked) return null;
  return (
    <p className="mt-0.5 text-xs text-[var(--warning)]">
      Can&apos;t be mobilised: {worker.blocked}.{" "}
      {worker.supplierId && (
        <Link href={`/suppliers/${worker.supplierId}`} target="_blank" rel="noopener noreferrer" className="font-medium underline">
          Open the supplier to approve
        </Link>
      )}
    </p>
  );
}
