"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmployeeAvatar } from "@/components/Avatar";
import { issueInventoryBulkAction, returnInventoryBulkAction } from "./actions";

export type VariantRow = { id: string; name: string; sku: string | null; stock: number; issued: number; available: number };
export type Holder = { id: string; employeeId: string; employeeName: string; employeeIdNo: string; variantName: string | null; quantity: number; issuedDate: string };
export type EmployeeOption = { id: string; name: string; employeeIdNo: string };
type Line = { employeeId: string; variantId: string; quantity: number };

const today = () => new Date().toLocaleDateString("en-CA");

/** Hand one item to several workers at once: pick the workers, a size for each, and how many. */
export function IssueDialog({ open, onClose, item, employees }: { open: boolean; onClose: () => void; item: { id: string; name: string; variants: VariantRow[] } | null; employees: EmployeeOption[] }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open && item && (
        <DialogContent title={`Issue ${item.name}`} description={`${item.variants.reduce((n, v) => n + v.available, 0)} available · pick who gets what`} className="max-w-xl">
          <IssueBody item={item} employees={employees} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function IssueBody({ item, employees, onClose }: { item: { id: string; name: string; variants: VariantRow[] }; employees: EmployeeOption[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const firstWithStock = item.variants.find((v) => v.available > 0)?.id ?? item.variants[0]?.id ?? "";
  const [lines, setLines] = useState<Line[]>([]);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const taken = new Set(lines.map((l) => l.employeeId));
  const asked = new Map<string, number>();
  for (const l of lines) asked.set(l.variantId, (asked.get(l.variantId) ?? 0) + l.quantity);
  const short = item.variants.filter((v) => (asked.get(v.id) ?? 0) > v.available);
  const left = item.variants.reduce((n, v) => n + v.available - (asked.get(v.id) ?? 0), 0);

  const update = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await issueInventoryBulkAction({ itemId: item.id, issuedDate: date, lines: lines.map((l) => ({ employeeId: l.employeeId, variantId: l.variantId || null, quantity: l.quantity })) });
      if (res.error) { setError(res.error); return; }
      setDone(res.issued);
      router.refresh();
    });
  }

  if (done !== null) {
    return (
      <div className="mt-4 text-center">
        <h3 className="text-lg font-semibold text-primary">Issued to {done} {done === 1 ? "worker" : "workers"}</h3>
        <p className="mt-1 text-sm text-muted">{item.name} · {left} left</p>
        <DialogFooter><button type="button" onClick={onClose} className="btn btn-primary">Done</button></DialogFooter>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <Select
        value=""
        onChange={(id) => id && setLines((prev) => [...prev, { employeeId: id, variantId: firstWithStock, quantity: 1 }])}
        placeholder="Add a worker — type a name or ID…"
        options={employees.filter((e) => !taken.has(e.id)).map((e) => ({ value: e.id, label: `${e.name} (${e.employeeIdNo})` }))}
      />
      {lines.length > 0 && (
        <ul className="card max-h-64 overflow-y-auto text-sm">
          {lines.map((l, i) => {
            const e = byId.get(l.employeeId);
            return (
              <li key={l.employeeId} className="flex items-center gap-3 border-b border-default px-3.5 py-2 last:border-b-0">
                <EmployeeAvatar employeeId={l.employeeId} name={e?.name ?? ""} hasPhoto={false} size="xs" />
                <span className="min-w-0 flex-1"><b className="block truncate text-primary">{e?.name}</b><span className="text-xs text-muted">{e?.employeeIdNo}</span></span>
                {item.variants.length > 1 && (
                  <div className="w-36 shrink-0">
                    <Select value={l.variantId} onChange={(v) => update(i, { variantId: v })} searchable={false} options={item.variants.map((v) => ({ value: v.id, label: `${v.name} (${v.available})` }))} />
                  </div>
                )}
                <div className="w-32 shrink-0"><NumberInput value={l.quantity} onChange={(v) => update(i, { quantity: Math.max(1, Number(String(v)) || 1) })} min={1} ariaLabel={`Quantity for ${e?.name}`} /></div>
                <button type="button" onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove ${e?.name}`} className="ml-1 shrink-0 text-subtle hover:text-secondary"><X className="h-4 w-4" aria-hidden /></button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Date issued</span><DatePicker value={date} onChange={setDate} max={today()} className="w-44" /></label>
        {lines.length > 0 && (
          <p className="pb-2 text-sm text-muted">{lines.length} {lines.length === 1 ? "worker" : "workers"} · {lines.reduce((n, l) => n + l.quantity, 0)} units. <b className={short.length ? "text-[var(--error)]" : "text-primary"}>{short.length ? `Not enough ${short.map((v) => v.name).join(", ")}` : `${left} left after`}</b></p>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <DialogFooter>
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="button" onClick={submit} disabled={pending || lines.length === 0 || short.length > 0} className="btn btn-primary">{pending ? "Issuing…" : `Issue to ${lines.length || ""} ${lines.length === 1 ? "worker" : "workers"}`.replace("  ", " ")}</button>
      </DialogFooter>
    </div>
  );
}

/** Take items back: tick the ones being returned. */
export function ReturnDialog({ open, onClose, item }: { open: boolean; onClose: () => void; item: { id: string; name: string; holders: Holder[] } | null }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open && item && (
        <DialogContent title={`Return ${item.name}`} description="Tick what's been handed back today." className="max-w-xl">
          <ReturnBody item={item} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ReturnBody({ item, onClose }: { item: { id: string; name: string; holders: Holder[] }; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const toggle = (id: string) => setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const all = picked.size === item.holders.length;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await returnInventoryBulkAction([...picked]);
      if (res.error) { setError(res.error); return; }
      setDone(res.returned);
      router.refresh();
    });
  }

  if (done !== null) {
    return (
      <div className="mt-4 text-center">
        <h3 className="text-lg font-semibold text-primary">{done} returned</h3>
        <DialogFooter><button type="button" onClick={onClose} className="btn btn-primary">Done</button></DialogFooter>
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary">
        <Checkbox checked={all} onCheckedChange={() => setPicked(all ? new Set() : new Set(item.holders.map((h) => h.id)))} ariaLabel="Select everyone" />
        Everyone ({item.holders.length})
      </label>
      <ul className="card max-h-72 overflow-y-auto text-sm">
        {item.holders.map((h) => (
          <li key={h.id} className="flex items-center gap-3 border-b border-default px-3.5 py-2.5 last:border-b-0">
            <Checkbox checked={picked.has(h.id)} onCheckedChange={() => toggle(h.id)} ariaLabel={`Return ${h.employeeName}'s ${item.name}`} />
            <span className="min-w-0 flex-1"><b className="block truncate text-primary">{h.employeeName}</b><span className="text-xs text-muted">{h.employeeIdNo} · since {new Date(h.issuedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span></span>
            <span className="text-secondary">{h.variantName ? `${h.variantName} · ` : ""}×{h.quantity}</span>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <DialogFooter>
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="button" onClick={submit} disabled={pending || picked.size === 0} className="btn btn-primary">{pending ? "Returning…" : `Return ${picked.size || ""}`.trim()}</button>
      </DialogFooter>
    </div>
  );
}
