"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BedDouble, Search } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { Nationality } from "@/components/Nationality";
import { Pagination } from "@/components/Pagination";
import { EmployeeAvatar } from "@/components/Avatar";
import { cn } from "@/lib/cn";
import { allocateBedAction, switchToExternalCampAction } from "../checkin-actions";
import { ExternalCampFields, type Party } from "../external-camp-fields";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { DatePicker } from "@/components/ui/DatePicker";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
type BedOption = { id: string; label: string; employeeId: string | null };
type RoomOption = { id: string; name: string; beds: BedOption[] };
type CampChoice = { id: string; name: string; rooms: RoomOption[] };
type Row = {
  checkInId: string;
  checkInNo: number;
  employeeName: string;
  employeeIdNo: string;
  employeeRecordId: string;
  employeeHasPhoto: boolean;
  nationality: string | null;
  supplierId: string | null;
  supplierName: string | null;
  clientId: string | null;
  clientName: string | null;
  campId: string;
  campName: string;
  roomName: string | null;
  bedLabel: string | null;
  bedId: string | null;
  checkInDate: string;
};

type Filter = "all" | "awaiting" | "allocated";
type Sort = "newest" | "name" | "room";
const PAGE_SIZE = 50;
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const todayIso = () => new Date().toISOString().slice(0, 10);

export function BedAllocationTable({ rows, camps, suppliers, clients }: { rows: Row[]; camps: CampChoice[]; suppliers: Party[]; clients: Party[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [moving, setMoving] = useState<Row[] | null>(null);
  const [query, setQuery] = useState("");
  const [campFilter, setCampFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [nationalityFilter, setNationalityFilter] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const list = rows.filter(
      (r) =>
        (filter === "all" || (filter === "awaiting" ? !r.bedId : !!r.bedId)) &&
        (!campFilter || r.campId === campFilter) &&
        (!supplierFilter || r.supplierId === supplierFilter) &&
        (!nationalityFilter || r.nationality === nationalityFilter) &&
        (!q || `${r.employeeName} ${r.employeeIdNo} CHK-${String(r.checkInNo).padStart(5, "0")} ${r.supplierName ?? ""} ${r.nationality ?? ""} ${r.campName} ${r.roomName ?? ""}`.toLowerCase().includes(q))
    );
    return [...list].sort((a, b) => (sort === "name" ? natural(a.employeeName, b.employeeName) : sort === "room" ? natural(`${a.campName} ${a.roomName ?? ""} ${a.bedLabel ?? ""}`, `${b.campName} ${b.roomName ?? ""} ${b.bedLabel ?? ""}`) : b.checkInNo - a.checkInNo));
  }, [rows, filter, campFilter, supplierFilter, nationalityFilter, q, sort]);

  const counts = { all: rows.length, awaiting: rows.filter((r) => !r.bedId).length, allocated: rows.filter((r) => r.bedId).length };
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const shown = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const chosen = rows.filter((r) => selected.has(r.checkInId));
  const allOn = visible.length > 0 && visible.every((r) => selected.has(r.checkInId));
  const someOn = visible.some((r) => selected.has(r.checkInId));
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const nationalities = [...new Set(rows.map((r) => r.nationality).filter((n): n is string => !!n))].sort(natural);
  const supplierOptions = [...new Map(rows.filter((r) => r.supplierId).map((r) => [r.supplierId as string, r.supplierName as string])).entries()].sort((a, b) => natural(a[1], b[1]));
  const reset = () => setPage(1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input value={query} onChange={(e) => { setQuery(e.target.value); reset(); }} placeholder="Search name, ID, supplier, room…" aria-label="Search workers" className="input w-full pl-9" />
        </label>
        <div className="w-44"><Select value={campFilter} onChange={(v) => { setCampFilter(v); reset(); }} placeholder="All camps" options={[{ value: "", label: "All camps" }, ...camps.map((c) => ({ value: c.id, label: c.name }))]} /></div>
        <div className="w-44"><Select value={supplierFilter} onChange={(v) => { setSupplierFilter(v); reset(); }} placeholder="All suppliers" options={[{ value: "", label: "All suppliers" }, ...supplierOptions.map(([id, name]) => ({ value: id, label: name }))]} /></div>
        <div className="w-44"><Select value={nationalityFilter} onChange={(v) => { setNationalityFilter(v); reset(); }} placeholder="All nationalities" options={[{ value: "", label: "All nationalities" }, ...nationalities.map((n) => ({ value: n, label: n }))]} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {([["all", `All (${counts.all})`], ["awaiting", `Waiting for a bed (${counts.awaiting})`], ["allocated", `Bed allocated (${counts.allocated})`]] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => { setFilter(key); reset(); }} className={cn("rounded-control border px-3 py-1.5 text-xs font-medium transition", filter === key ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default bg-surface text-secondary hover:bg-surface-hover")}>{label}</button>
        ))}
        <span className="flex-1" />
        <div className="w-44"><Select value={sort} onChange={(v) => setSort(v as Sort)} searchable={false} options={[{ value: "newest", label: "Newest check-in" }, { value: "name", label: "Name A–Z" }, { value: "room", label: "Camp and room" }]} /></div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="w-10 px-4 py-3"><Checkbox checked={allOn} indeterminate={!allOn && someOn} onCheckedChange={(on) => setSelected(on ? new Set(visible.map((r) => r.checkInId)) : new Set())} ariaLabel="Select everyone shown" /></th>
              <th className="px-2 py-3">Employee</th>
              <th className="px-2 py-3">Nationality</th>
              <th className="px-2 py-3">Supplier</th>
              <th className="px-2 py-3">Camp</th>
              <th className="px-2 py-3">Room · Bed</th>
              <th className="px-2 py-3">Since</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.checkInId} className={cn("border-t border-default", selected.has(r.checkInId) && "bg-brand-soft", !r.bedId && !selected.has(r.checkInId) && "bg-[var(--warning-soft)]/30")}>
                <td className="px-4 py-2.5"><Checkbox checked={selected.has(r.checkInId)} onCheckedChange={() => toggle(r.checkInId)} ariaLabel={`Select ${r.employeeName}`} /></td>
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <EmployeeAvatar employeeId={r.employeeRecordId} name={r.employeeName} hasPhoto={r.employeeHasPhoto} size="sm" />
                    <span className="min-w-0"><span className="block truncate font-medium text-primary">{r.employeeName}</span><span className="text-xs text-subtle">{r.employeeIdNo} · CHK-{String(r.checkInNo).padStart(5, "0")}</span></span>
                  </span>
                </td>
                <td className="px-2 py-2.5 text-secondary"><Nationality name={r.nationality} /></td>
                <td className="max-w-[12rem] truncate px-2 py-2.5 text-muted">{r.supplierName ?? "—"}</td>
                <td className="px-2 py-2.5 text-secondary">{r.campName}</td>
                <td className="px-2 py-2.5">{r.bedId ? <Badge color="green" dot>{r.roomName} · {r.bedLabel}</Badge> : <Badge color="amber" dot>Waiting for a bed</Badge>}</td>
                <td className="px-2 py-2.5 text-muted tabular">{shortDate(r.checkInDate)}</td>
                <td className="px-4 py-2.5 text-right"><button type="button" onClick={() => setMoving([r])} className={cn("btn btn-sm gap-1.5", r.bedId ? "btn-secondary" : "btn-primary")}><BedDouble className="h-3.5 w-3.5" aria-hidden />{r.bedId ? "Move" : "Allocate bed"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">{rows.length === 0 ? "No one is checked into a camp right now, start under Check-In." : "Nothing matches this filter."}</p>
        )}
        {visible.length > 0 && <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} totalItems={visible.length} pageSize={PAGE_SIZE} />}
      </div>
      <p className="text-xs text-muted">Tick several workers to move them together into one room.</p>

      {chosen.length > 0 && (
        <div className="sticky bottom-4 z-20 flex justify-center">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#1e1b3a] py-2.5 pr-2.5 pl-4 text-sm text-white shadow-modal">
            <b className="mr-1">{chosen.length} selected</b>
            <button type="button" onClick={() => setMoving(chosen)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10"><BedDouble className="h-3.5 w-3.5" aria-hidden />{chosen.length === 1 ? "Move" : "Move together"}</button>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white">Clear</button>
          </div>
        </div>
      )}

      <MoveDialog workers={moving} camps={camps} suppliers={suppliers} clients={clients} onClose={() => setMoving(null)} onDone={() => { setMoving(null); setSelected(new Set()); }} />
    </div>
  );
}

function MoveDialog({ workers, camps, suppliers, clients, onClose, onDone }: { workers: Row[] | null; camps: CampChoice[]; suppliers: Party[]; clients: Party[]; onClose: () => void; onDone: () => void }) {
  const first = workers?.[0];
  const many = (workers?.length ?? 0) > 1;
  return (
    <Dialog modal={false} open={workers !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideTitle title={many ? `Move ${workers?.length} workers` : `Move ${first?.employeeName ?? ""}`} className="max-w-3xl!">
        {workers && <MoveForm key={workers.map((w) => w.checkInId).join(",")} workers={workers} camps={camps} suppliers={suppliers} clients={clients} onClose={onClose} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

function MoveForm({ workers, camps, suppliers, clients, onClose, onDone }: { workers: Row[]; camps: CampChoice[]; suppliers: Party[]; clients: Party[]; onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const many = workers.length > 1;
  const one = workers[0];
  const [campType, setCampType] = useState<"OWN" | "SUPPLIER" | "CLIENT">("OWN");
  const [partyId, setPartyId] = useState("");
  const [externalCamp, setExternalCamp] = useState("");
  const [campId, setCampId] = useState(one.campId);
  const [roomId, setRoomId] = useState("");
  const [bedIds, setBedIds] = useState<string[]>([]);
  const [date, setDate] = useState(one.bedId ? todayIso() : one.checkInDate);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const external = campType !== "OWN";
  const knownPartyId = campType === "SUPPLIER" ? one.supplierId : one.clientId;
  const effectivePartyId = knownPartyId ?? partyId;

  // A bed counts as free if nobody is in it, or if one of the workers being moved is in it now.
  const leaving = new Set(workers.map((w) => w.bedId).filter((b): b is string => !!b));
  const isFree = (b: BedOption) => !b.employeeId || leaving.has(b.id);
  const camp = camps.find((c) => c.id === campId) ?? null;
  const room = camp?.rooms.find((r) => r.id === roomId) ?? null;
  const freeBeds = room ? room.beds.filter(isFree).sort((a, b) => natural(a.label, b.label)) : [];
  const vacancy = (beds: BedOption[]) => ({ free: beds.filter(isFree).length, total: beds.length });

  const pickBed = (id: string) => setBedIds((cur) => (many ? (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < workers.length ? [...cur, id] : cur) : [id]));
  const autoPick = () => setBedIds(freeBeds.slice(0, workers.length).map((b) => b.id));
  const bedLabel = (id: string) => room?.beds.find((b) => b.id === id)?.label ?? "";
  const ready = external ? !!effectivePartyId && externalCamp.trim() !== "" : bedIds.length === workers.length;

  function submit() {
    setError(null);
    startTransition(async () => {
      if (external) {
        const fd = new FormData();
        fd.append("checkInId", one.checkInId);
        fd.append("campType", campType);
        fd.append("partyId", effectivePartyId);
        fd.append("campName", externalCamp.trim());
        fd.append("checkInDate", date);
        const res = await switchToExternalCampAction(fd);
        if (res.error) return setError(res.error);
        router.refresh();
        return onDone();
      }
      for (let i = 0; i < workers.length; i++) {
        const fd = new FormData();
        fd.append("checkInId", workers[i].checkInId);
        fd.append("bedId", bedIds[i]);
        fd.append("checkInDate", date);
        await allocateBedAction(fd);
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3 pr-8">
        {many ? <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-[var(--brand-primary)]">{workers.length}</span> : <EmployeeAvatar employeeId={one.employeeRecordId} name={one.employeeName} hasPhoto={one.employeeHasPhoto} size="lg" />}
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-primary">{many ? `Move ${workers.length} workers together` : one.bedId ? `Move ${one.employeeName}` : `Place ${one.employeeName}`}</h2>
          <p className="truncate text-xs text-muted">{many ? workers.slice(0, 3).map((w) => w.employeeName).join(", ") + (workers.length > 3 ? ` and ${workers.length - 3} more` : "") : `${one.employeeIdNo}${one.nationality ? ` · ${one.nationality}` : ""}${one.supplierName ? ` · ${one.supplierName}` : ""}`}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-surface-subtle px-3 py-2 text-sm">
        <span className="text-muted">Now</span>
        {many ? <span className="font-medium text-primary">{new Set(workers.map((w) => w.campName)).size === 1 ? workers[0].campName : "several camps"}</span> : <><span className="font-medium text-primary">{one.campName}</span>{one.bedId && <Badge color="green" dot>{one.roomName} · {one.bedLabel}</Badge>}</>}
        <ArrowRight className="h-3.5 w-3.5 text-subtle" aria-hidden />
        <span className="text-muted">Moving to</span>
        <span className={cn("font-medium", ready ? "text-[var(--brand-primary)]" : "text-subtle")}>
          {external ? (externalCamp.trim() ? `${externalCamp.trim()} (${campType === "SUPPLIER" ? "supplier" : "client"} camp)` : "pick below") : room && bedIds.length > 0 ? `${camp?.name} · ${room.name} · ${bedIds.map(bedLabel).join(", ")}` : "pick below"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[1fr_1.15fr]">
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">1 · Camp</p>
          {!many && (
            <SegmentedControl value={campType} onChange={(v) => { setCampType(v as "OWN" | "SUPPLIER" | "CLIENT"); setError(null); }} options={[{ value: "OWN", label: "Own" }, { value: "SUPPLIER", label: "Supplier" }, { value: "CLIENT", label: "Client" }]} />
          )}
          {external ? (
            <div className="mt-3">
              <ExternalCampFields kind={campType as "SUPPLIER" | "CLIENT"} knownPartyId={knownPartyId} knownPartyName={campType === "SUPPLIER" ? one.supplierName : one.clientName} parties={campType === "SUPPLIER" ? suppliers : clients} partyId={partyId} onParty={setPartyId} campName={externalCamp} onCampName={setExternalCamp} />
            </div>
          ) : (
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {camps.map((c) => {
                const v = vacancy(c.rooms.flatMap((r) => r.beds));
                const usedPct = v.total ? Math.round(((v.total - v.free) / v.total) * 100) : 0;
                const on = c.id === campId;
                return (
                  <button key={c.id} type="button" onClick={() => { setCampId(c.id); setRoomId(""); setBedIds([]); }} aria-pressed={on} className={cn("w-full rounded-xl border-[1.5px] px-3 py-2.5 text-left transition", on ? "border-[var(--brand-primary)] bg-brand-soft" : "border-default hover:bg-surface-hover")}>
                    <span className="flex items-center justify-between gap-2"><b className="truncate text-sm text-primary">{c.name}</b><span className="shrink-0 text-xs text-muted">{v.free} of {v.total} free</span></span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-sunken"><span className="block h-full rounded-full" style={{ width: `${usedPct}%`, background: usedPct >= 95 ? "var(--error)" : usedPct >= 80 ? "var(--warning)" : "var(--success)" }} /></span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!external && (
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">2 · Room</p>
            {!camp ? <p className="text-sm text-muted">Pick a camp first.</p> : (
              <div className="grid max-h-36 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                {camp.rooms.map((r) => {
                  const v = vacancy(r.beds);
                  const on = r.id === roomId;
                  const full = v.free < 1;
                  return (
                    <button key={r.id} type="button" disabled={full} onClick={() => { setRoomId(r.id); setBedIds([]); }} aria-pressed={on} className={cn("rounded-xl border-[1.5px] px-2 py-2 text-center transition disabled:opacity-40", on ? "border-[var(--brand-primary)] bg-brand-soft" : "border-default hover:bg-surface-hover")}>
                      <b className="block text-[13px] text-primary">{r.name}</b>
                      <span className="text-[11px] text-muted">{v.free}/{v.total} free</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">3 · {many ? `Beds in ${room?.name ?? "the room"} (pick ${workers.length})` : `Bed in ${room?.name ?? "the room"}`}</p>
              {many && room && <button type="button" onClick={autoPick} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Pick the first {workers.length} free</button>}
            </div>
            {!room ? <p className="mt-1.5 text-sm text-muted">Pick a room first.</p> : (
              <>
                <div className="mt-2 grid max-h-40 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                  {room.beds.slice().sort((a, b) => natural(a.label, b.label)).map((b) => {
                    const free = isFree(b);
                    const sel = bedIds.includes(b.id);
                    return <button key={b.id} type="button" disabled={!free} onClick={() => pickBed(b.id)} aria-pressed={sel} className={cn("rounded-lg border px-1 py-1.5 text-center text-xs transition", sel ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] font-bold text-white" : free ? "border-[var(--success-border)] bg-[var(--success-soft)] font-semibold text-[var(--success)] hover:brightness-95" : "cursor-not-allowed border-default bg-surface-sunken text-subtle")}>{b.label}</button>;
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-subtle">Green is free. Grey is taken.{many ? ` ${bedIds.length} of ${workers.length} picked.` : ""}</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block w-52">
          <span className="mb-1 block text-xs font-medium text-muted">{one.bedId || many ? "Move date" : "Check-in date"}</span>
          <DatePicker value={date} onChange={setDate} className="w-full" />
        </label>
        <button type="button" onClick={() => setDate(todayIso())} className={cn("mb-1 rounded-control border px-3 py-1.5 text-xs font-medium", date === todayIso() ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default text-secondary hover:bg-surface-hover")}>Today</button>
      </div>

      {error && <Alert className="mt-3">{error}</Alert>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
        <p className="max-w-md text-xs text-muted">{one.bedId || many ? "The old bed becomes free and the move is added to the worker's history." : "The worker is placed and the placement is added to their history."}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <Button size="btn" type="button" disabled={!ready || pending} onClick={submit} loading={pending}>{many ? `Move ${workers.length} here` : one.bedId || external ? "Move here" : "Allocate"}</Button>
        </div>
      </div>
    </div>
  );
}
