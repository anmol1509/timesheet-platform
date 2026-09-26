"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { BedDouble, BedSingle, ExternalLink, Layers, MoreHorizontal, Plus, Search, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { DeleteButton } from "@/components/DeleteButton";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { InlineEditRow } from "@/components/InlineEditRow";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { NumberInput } from "@/components/ui/NumberInput";
import { Badge } from "@/components/Badge";
import { EmployeeAvatar } from "@/components/Avatar";
import { groupBeds } from "@/lib/bunk";
import { cn } from "@/lib/cn";
import {
  unassignBedAction,
  updateRoomAction,
  deleteRoomAction,
  addBedsToRoomAction,
  deleteBedAction,
  placeWorkerInBedAction,
} from "../actions";

type Bed = { id: string; label: string; employeeId: string | null };
type Room = {
  id: string;
  name: string;
  beds: Bed[];
  roomType: string | null;
  nationality: string | null;
};
type Person = { id: string; name: string; employeeIdNo: string; hasPhoto: boolean };
type Unhoused = { id: string; name: string; employeeIdNo: string; trade: string | null; hasPhoto: boolean };

/** "Add beds" lives in a small popover so the room header stays readable: pick single beds or bunks, and how many. */
function AddBeds({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"single" | "bunk">("single");
  const [count, setCount] = useState<number | "">(1);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="btn btn-secondary btn-sm gap-1.5">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add beds
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="rx-popover z-50 w-72 rounded-card border border-default bg-surface p-4 shadow-popover">
          <form
            action={async (fd) => {
              await addBedsToRoomAction(fd);
              setOpen(false);
              setCount(1);
            }}
            className="space-y-3"
          >
            <input type="hidden" name="roomId" value={roomId} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="count" value={count === "" ? 1 : count} />
            <p className="text-sm font-semibold text-primary">Add to this room</p>
            <SegmentedControl
              value={kind}
              onChange={(v) => setKind(v as "single" | "bunk")}
              options={[
                { value: "single", label: "Single beds" },
                { value: "bunk", label: "Bunk beds" },
              ]}
            />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">{kind === "bunk" ? "How many bunks?" : "How many beds?"}</span>
              <NumberInput value={count} onChange={setCount} min={1} max={20} ariaLabel="Count" />
            </label>
            {kind === "bunk" && <p className="text-xs text-muted">Each bunk adds an upper and a lower berth ({(count === "" ? 1 : count) * 2} beds).</p>}
            <button type="submit" className="btn btn-primary w-full">
              Add {kind === "bunk" ? `${count === "" ? 1 : count} bunk${count === 1 || count === "" ? "" : "s"}` : `${count === "" ? 1 : count} bed${count === 1 || count === "" ? "" : "s"}`}
            </button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function CampView({
  rooms,
  employeeNames,
  unhoused = [],
}: {
  rooms: Room[];
  employeeNames: Record<string, Person>;
  /** Workers with no bed, offered as a tray to drag onto a vacant bed. */
  unhoused?: Unhoused[];
}) {
  const [vacantOnly, setVacantOnly] = useState(false);
  const router = useRouter();
  const [, start] = useTransition();
  const [dragEmp, setDragEmp] = useState<string | null>(null);
  const [overBed, setOverBed] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [trayQuery, setTrayQuery] = useState("");
  // Clicking a bed opens a modal: assign a worker, delete the bed, or check the occupant out.
  const [active, setActive] = useState<{ bed: Bed; room: Room } | null>(null);
  const [mode, setMode] = useState<"menu" | "assign" | "delete" | "checkout">("menu");
  const [assignQuery, setAssignQuery] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const openBed = (bed: Bed, room: Room) => {
    setActive({ bed, room });
    setMode("menu");
    setAssignQuery("");
    setModalError(null);
  };
  const closeBed = () => setActive(null);

  function dropOn(bedId: string) {
    const emp = dragEmp;
    setDragEmp(null);
    setOverBed(null);
    if (!emp) return;
    setMoveError(null);
    start(async () => {
      const res = await placeWorkerInBedAction(emp, bedId);
      if (res.error) setMoveError(res.error);
      router.refresh();
    });
  }
  function assignTo(employeeId: string) {
    if (!active) return;
    setModalError(null);
    start(async () => {
      const res = await placeWorkerInBedAction(employeeId, active.bed.id);
      if (res.error) setModalError(res.error);
      else closeBed();
      router.refresh();
    });
  }
  const assignList = unhoused.filter((u) => `${u.name} ${u.employeeIdNo} ${u.trade ?? ""}`.toLowerCase().includes(assignQuery.trim().toLowerCase()));
  const tray = unhoused.filter((u) => `${u.name} ${u.employeeIdNo} ${u.trade ?? ""}`.toLowerCase().includes(trayQuery.trim().toLowerCase()));

  const allBeds = rooms.flatMap((r) => r.beds);
  const vacantCount = allBeds.filter((b) => !b.employeeId).length;

  if (rooms.length === 0) {
    return <p className="empty-state py-10 text-sm text-muted">This camp has no rooms yet — add one below.</p>;
  }

  /** One berth or bed: an occupant you can drag or check out, or a vacant slot you can drop a worker on. */
  // A plain render function, not a component: a component defined here would remount on every drag event and cancel the drag.
  function renderSlot(bed: Bed, room: Room, caption?: string) {
    const occupant = bed.employeeId ? employeeNames[bed.employeeId] : null;
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`${bed.label} in ${room.name}${occupant ? `, ${occupant.name}` : ", vacant"}`}
        onClick={() => openBed(bed, room)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openBed(bed, room);
          }
        }}
        draggable={!!occupant}
        onDragStart={() => occupant && bed.employeeId && setDragEmp(bed.employeeId)}
        onDragEnd={() => {
          setDragEmp(null);
          setOverBed(null);
        }}
        onDragOver={(e) => {
          if (!occupant && dragEmp) {
            e.preventDefault();
            setOverBed(bed.id);
          }
        }}
        onDragLeave={() => setOverBed((o) => (o === bed.id ? null : o))}
        onDrop={(e) => {
          if (!occupant) {
            e.preventDefault();
            dropOn(bed.id);
          }
        }}
        className={cn(
          "group relative flex min-h-[3.25rem] items-center gap-2.5 rounded-control border px-2.5 py-2 transition",
          occupant ? "cursor-grab border-default bg-surface hover:border-strong active:cursor-grabbing" : "cursor-pointer border-dashed border-default bg-surface-subtle hover:border-[var(--brand-primary)] hover:bg-brand-soft",
          !occupant && dragEmp && "border-[var(--brand-primary)]/60",
          overBed === bed.id && "border-solid bg-brand-soft ring-2 ring-[var(--brand-primary)]"
        )}
      >
        {caption && <span className="w-9 shrink-0 text-[10px] font-semibold tracking-wide text-subtle uppercase">{caption}</span>}
        {occupant ? (
          <>
            <EmployeeAvatar employeeId={occupant.id} name={occupant.name} hasPhoto={occupant.hasPhoto} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-primary" title={occupant.name}>{occupant.name}</span>
              <span className="tabular block truncate text-[10px] text-subtle">{occupant.employeeIdNo}</span>
            </span>
          </>
        ) : (
          <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
              <BedDouble className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-secondary">Vacant</span>
              <span className="block text-[10px] text-subtle">{dragEmp ? "Drop a worker here" : "Available"}</span>
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          value={vacantOnly ? "vacant" : "all"}
          onChange={(v) => setVacantOnly(v === "vacant")}
          options={[
            { value: "all", label: `All beds (${allBeds.length})` },
            { value: "vacant", label: `Vacant only (${vacantCount})` },
          ]}
        />
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--success)]" /> Vacant</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--brand-primary)]" /> Occupied</span>
          <span className="flex items-center gap-1.5"><Layers className="h-3 w-3" aria-hidden /> Bunk (upper / lower)</span>
        </div>
      </div>

      {moveError && <p role="alert" className="text-sm text-[var(--error)]">{moveError}</p>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:items-start">
          {rooms.map((room) => {
            const occupied = room.beds.filter((b) => b.employeeId).length;
            const total = room.beds.length;
            const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
            const full = total > 0 && occupied === total;
            const groups = groupBeds(room.beds).filter((g) => (vacantOnly ? (g.kind === "single" ? !g.bed.employeeId : !(g.upper?.employeeId && g.lower?.employeeId)) : true));
            const bunkCount = groupBeds(room.beds).filter((g) => g.kind === "bunk").length;
            return (
              <section key={room.id} className="card p-4" aria-label={room.name}>
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <InlineEditRow value={room.name} action={updateRoomAction} hiddenFields={{ roomId: room.id }} />
                      {full ? <Badge color="red" dot>Full</Badge> : <Badge color="green" dot>{total - occupied} free</Badge>}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <span className="tabular">{occupied}/{total} occupied</span>
                      {bunkCount > 0 && <span className="flex items-center gap-1"><Layers className="h-3 w-3" aria-hidden />{bunkCount} bunk{bunkCount === 1 ? "" : "s"}</span>}
                      {room.roomType && <span>· {room.roomType}</span>}
                      {room.nationality && <span>· {room.nationality}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <AddBeds roomId={room.id} />
                    <Popover.Root>
                      <Popover.Trigger asChild>
                        <button type="button" aria-label={`More for ${room.name}`} className="rounded-control border border-default p-1.5 text-subtle transition hover:bg-surface-hover hover:text-secondary">
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content align="end" sideOffset={6} className="rx-popover z-50 w-52 rounded-card border border-default bg-surface p-1.5 shadow-popover">
                          <DeleteButton
                            action={deleteRoomAction}
                            hiddenFields={{ roomId: room.id }}
                            confirmMessage={`Delete ${room.name}? Its ${room.beds.length} bed(s) will be removed, unassigning anyone housed there.`}
                            label="Delete room"
                            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                          />
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>
                </header>

                <div className="mt-3 mb-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div className={cn("h-full rounded-full transition-all", full ? "bg-[var(--error)]" : "bg-[var(--brand-primary)]")} style={{ width: `${pct}%` }} />
                </div>

                {groups.length === 0 ? (
                  <p className="rounded-control border border-dashed border-default px-3 py-4 text-center text-xs text-subtle">
                    {total === 0 ? "No beds yet — use Add beds." : "No vacant beds in this room."}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {groups.map((g) =>
                      g.kind === "single" ? (
                        <div key={g.bed.id} className="space-y-1">
                          <p className="flex items-center gap-1 px-0.5 text-[10px] font-semibold tracking-wide text-subtle uppercase"><BedSingle className="h-3 w-3" aria-hidden />{g.bed.label}</p>
                          {renderSlot(g.bed, room)}
                        </div>
                      ) : (
                        <div key={`bunk-${g.no}`} className="space-y-1 rounded-card border border-default bg-surface-subtle p-2">
                          <p className="flex items-center gap-1 px-0.5 text-[10px] font-semibold tracking-wide text-subtle uppercase"><Layers className="h-3 w-3" aria-hidden />Bunk {String(g.no).padStart(2, "0")}</p>
                          {g.upper ? renderSlot(g.upper, room, "Upper") : <p className="px-2 py-2 text-[11px] text-subtle">Upper berth missing</p>}
                          {g.lower ? renderSlot(g.lower, room, "Lower") : <p className="px-2 py-2 text-[11px] text-subtle">Lower berth missing</p>}
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <aside className="card h-fit p-3 xl:sticky xl:top-20" aria-label="Workers without a bed">
          <h3 className="text-sm font-semibold text-primary">Without a bed <span className="tabular text-xs font-normal text-muted">({unhoused.length})</span></h3>
          <p className="mt-0.5 text-xs text-muted">Drag a worker onto a vacant bed or berth. You can also drag housed workers between beds.</p>
          <input value={trayQuery} onChange={(e) => setTrayQuery(e.target.value)} placeholder="Search…" aria-label="Search unhoused workers" className="input mt-2 w-full py-1 text-xs" />
          <ul className="mt-2 max-h-[55vh] space-y-1.5 overflow-y-auto">
            {tray.length === 0 && <li className="py-4 text-center text-xs text-subtle">{unhoused.length === 0 ? "Everyone has a bed." : "No match."}</li>}
            {tray.map((u) => (
              <li
                key={u.id}
                draggable
                onDragStart={() => setDragEmp(u.id)}
                onDragEnd={() => {
                  setDragEmp(null);
                  setOverBed(null);
                }}
                className="flex cursor-grab items-center gap-2 rounded-lg border border-default bg-surface px-2 py-1.5 active:cursor-grabbing"
              >
                <EmployeeAvatar employeeId={u.id} name={u.name} hasPhoto={u.hasPhoto} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-primary">{u.name}</span>
                  <span className="block truncate text-[10px] text-subtle">{u.employeeIdNo}{u.trade ? ` · ${u.trade}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <Dialog open={active !== null} onOpenChange={(o) => !o && closeBed()}>
        {active && (() => {
          // Read the bed from the current data, not the copy taken at click time, so the modal never shows a stale state.
          const live = rooms.flatMap((r) => r.beds).find((b) => b.id === active.bed.id);
          const bed = live ?? active.bed;
          const room = active.room;
          const occ = bed.employeeId ? employeeNames[bed.employeeId] : null;
          return (
            <DialogContent title={`${bed.label} · ${room.name}`} description={occ ? "Occupied" : "Vacant bed"} className="max-w-md">
              {modalError && <p role="alert" className="mt-3 text-sm text-[var(--error)]">{modalError}</p>}

              {mode === "menu" && occ && (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-default bg-surface-subtle p-3">
                    <EmployeeAvatar employeeId={occ.id} name={occ.name} hasPhoto={occ.hasPhoto} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-primary">{occ.name}</span>
                      <span className="tabular block text-xs text-muted">{occ.employeeIdNo}</span>
                    </span>
                    <Link href={`/employees/${bed.employeeId}`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline"><ExternalLink className="h-3 w-3" aria-hidden />Profile</Link>
                  </div>
                  <p className="text-xs text-muted">To move them to another bed, drag them there, or check them out first.</p>
                  <button type="button" className="btn btn-secondary w-full text-red-600" onClick={() => setMode("checkout")}>Check out of this bed</button>
                </div>
              )}

              {mode === "menu" && !occ && (
                <div className="mt-4 grid gap-2">
                  <button type="button" className="btn btn-primary w-full gap-2" onClick={() => setMode("assign")}><UserPlus className="h-4 w-4" aria-hidden />Assign a worker</button>
                  <button type="button" className="btn btn-secondary w-full gap-2 text-red-600" onClick={() => setMode("delete")}><Trash2 className="h-4 w-4" aria-hidden />Delete this bed</button>
                </div>
              )}

              {mode === "assign" && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-secondary">Workers who don&apos;t have a bed yet ({unhoused.length}). Pick one to place in this bed.</p>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
                    <input autoFocus value={assignQuery} onChange={(e) => setAssignQuery(e.target.value)} placeholder="Search by name, ID or trade…" aria-label="Search workers without a bed" className="input w-full pl-9" />
                  </div>
                  <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    {assignList.length === 0 && <li className="py-6 text-center text-sm text-muted">{unhoused.length === 0 ? "Everyone already has a bed." : "No worker matches."}</li>}
                    {assignList.map((u) => (
                      <li key={u.id}>
                        <button type="button" onClick={() => assignTo(u.id)} className="flex w-full items-center gap-3 rounded-lg border border-default bg-surface px-3 py-2 text-left transition hover:border-[var(--brand-primary)] hover:bg-brand-soft">
                          <EmployeeAvatar employeeId={u.id} name={u.name} hasPhoto={u.hasPhoto} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-primary">{u.name}</span>
                            <span className="tabular block truncate text-xs text-muted">{u.employeeIdNo}{u.trade ? ` · ${u.trade}` : ""}</span>
                          </span>
                          <span className="text-xs font-medium text-[var(--brand-primary)]">Assign</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="btn btn-secondary" onClick={() => setMode("menu")}>Back</button>
                </div>
              )}

              {mode === "delete" && (
                <form
                  className="mt-4 space-y-4"
                  action={async (fd) => {
                    await deleteBedAction(fd);
                    closeBed();
                    router.refresh();
                  }}
                >
                  <input type="hidden" name="bedId" value={bed.id} />
                  <p className="text-sm text-secondary">Delete <span className="font-medium text-primary">{bed.label}</span> from {room.name}? Nobody is in it. This can&apos;t be undone.</p>
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn btn-secondary" onClick={() => setMode("menu")}>Cancel</button>
                    <button type="submit" className="btn btn-danger">Delete bed</button>
                  </div>
                </form>
              )}

              {mode === "checkout" && occ && (
                <form
                  className="mt-4 space-y-4"
                  action={async (fd) => {
                    await unassignBedAction(fd);
                    closeBed();
                    router.refresh();
                  }}
                >
                  <input type="hidden" name="bedId" value={bed.id} />
                  <input type="hidden" name="employeeId" value={bed.employeeId ?? ""} />
                  <p className="text-sm text-secondary">Check <span className="font-medium text-primary">{occ.name}</span> out of {bed.label}? They will show under &ldquo;Without a bed&rdquo;.</p>
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn btn-secondary" onClick={() => setMode("menu")}>Cancel</button>
                    <button type="submit" className="btn btn-danger">Check out</button>
                  </div>
                </form>
              )}
            </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
}
