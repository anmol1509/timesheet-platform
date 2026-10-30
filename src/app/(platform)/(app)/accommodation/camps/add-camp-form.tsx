"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { createCampWithRoomsAction } from "../actions";
import { NumberInput } from "@/components/ui/NumberInput";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
type RoomDraft = { name: string; bedCount: number; bunkCount: number };
const clamp = (v: unknown, min: number, max: number) => Math.max(min, Math.min(max, Number(String(v)) || 0));

function build(count: number, bunks: number, singles: number, previous: RoomDraft[]): RoomDraft[] {
  return Array.from({ length: count }, (_, i) => ({ name: previous[i]?.name ?? `Room ${i + 1}`, bunkCount: bunks, bedCount: singles }));
}

/** "+ Add camp": a name and how it is laid out; rooms are created with it. */
export function AddCampForm({ primary }: { primary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={cn("btn btn-sm shrink-0 gap-1.5", primary ? "btn-primary" : "btn-secondary")}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add camp
        </button>
      </DialogTrigger>
      {open && (
        <DialogContent title="Add a camp" description="One of your own camps. Supplier and client camps are recorded when you check workers in." className="max-w-xl">
          <AddCampBody />
        </DialogContent>
      )}
    </Dialog>
  );
}

function AddCampBody() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCount, setRoomCount] = useState(4);
  const [bunks, setBunks] = useState(2);
  const [singles, setSingles] = useState(0);
  const [rooms, setRooms] = useState<RoomDraft[]>(() => build(4, 2, 0, []));
  const [custom, setCustom] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Changing the layout re-lays every room; names you typed are kept.
  function layout(next: { count?: number; bunks?: number; singles?: number }) {
    const c = next.count ?? roomCount;
    const b = next.bunks ?? bunks;
    const s = next.singles ?? singles;
    setRoomCount(c);
    setBunks(b);
    setSingles(s);
    setRooms((prev) => build(c, b, s, prev));
  }
  function updateRoom(index: number, patch: Partial<RoomDraft>) {
    setRooms((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  const totalBeds = rooms.reduce((sum, r) => sum + r.bedCount + r.bunkCount * 2, 0);
  const canSubmit = name.trim().length > 0 && rooms.every((r) => r.name.trim().length > 0 && r.bedCount + r.bunkCount > 0);

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("roomsJson", JSON.stringify(rooms));
    startTransition(async () => {
      const result = await createCampWithRoomsAction(formData);
      if ("error" in result) setError(result.error);
      else router.push(`/accommodation/camps?campId=${result.campId}`);
    });
  }

  const label = "mb-1.5 block text-xs font-medium text-muted";
  return (
    <div className="mt-5 space-y-5">
      <label className="block">
        <span className={label}>Camp name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Dubai Industrial Camp 1" className="input w-full" />
      </label>

      <div>
        <span className={label}>Layout</span>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-subtle">Rooms</span>
            <NumberInput value={roomCount} onChange={(v) => layout({ count: clamp(v, 1, 50) })} min={1} max={50} ariaLabel="Number of rooms" className="w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-subtle">Bunks per room</span>
            <NumberInput value={bunks} onChange={(v) => layout({ bunks: clamp(v, 0, 20) })} min={0} max={20} ariaLabel="Bunks in every room" className="w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-subtle">Single beds per room</span>
            <NumberInput value={singles} onChange={(v) => layout({ singles: clamp(v, 0, 20) })} min={0} max={20} ariaLabel="Single beds in every room" className="w-full" />
          </label>
        </div>
        <p className="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-primary">
          <b>{rooms.length}</b> room{rooms.length === 1 ? "" : "s"} · <b>{totalBeds}</b> bed{totalBeds === 1 ? "" : "s"}
          <span className="text-muted">: a bunk counts as 2 beds (upper and lower)</span>
        </p>
      </div>

      <div>
        <button type="button" onClick={() => setCustom((v) => !v)} aria-expanded={custom} className="flex items-center gap-1 text-sm font-medium text-[var(--brand-primary)] hover:underline">
          <ChevronDown className={cn("h-4 w-4 transition-transform", custom && "rotate-180")} aria-hidden />
          Name or change individual rooms
        </button>
        {custom && (
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {rooms.map((room, i) => (
              <div key={i} className="grid grid-cols-[1fr_8.5rem_8.5rem] items-center gap-2">
                <input value={room.name} onChange={(e) => updateRoom(i, { name: e.target.value })} aria-label={`Room ${i + 1} name`} className="input w-full" />
                <NumberInput value={room.bunkCount} onChange={(v) => updateRoom(i, { bunkCount: clamp(v, 0, 20) })} min={0} max={20} ariaLabel={`Bunks in ${room.name}`} />
                <NumberInput value={room.bedCount} onChange={(v) => updateRoom(i, { bedCount: clamp(v, 0, 20) })} min={0} max={20} ariaLabel={`Single beds in ${room.name}`} />
              </div>
            ))}
            <p className="text-xs text-subtle">Columns: room name · bunks · single beds</p>
          </div>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      <DialogFooter>
        <Button size="btn" type="button" onClick={handleSubmit} disabled={!canSubmit || pending} loading={pending}>
          {`Create camp with ${totalBeds} bed${totalBeds === 1 ? "" : "s"}`}
        </Button>
      </DialogFooter>
    </div>
  );
}
