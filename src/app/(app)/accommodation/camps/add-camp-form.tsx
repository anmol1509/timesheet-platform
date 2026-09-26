"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCampWithRoomsAction } from "../actions";
import { NumberInput } from "@/components/ui/NumberInput";

type RoomDraft = { name: string; bedCount: number; bunkCount: number };

function defaultRooms(count: number, previous: RoomDraft[]): RoomDraft[] {
  return Array.from({ length: count }, (_, i) => previous[i] ?? { name: `Room ${i + 1}`, bedCount: 4, bunkCount: 0 });
}

export function AddCampForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCount, setRoomCount] = useState(1);
  const [rooms, setRooms] = useState<RoomDraft[]>(defaultRooms(1, []));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function changeRoomCount(count: number) {
    const clamped = Math.max(1, Math.min(50, count || 1));
    setRoomCount(clamped);
    setRooms((prev) => defaultRooms(clamped, prev));
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
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`/accommodation/camps?campId=${result.campId}`);
      }
    });
  }

  return (
    <div className="card space-y-4 p-5">
      <h3 className="text-sm font-semibold text-primary">Add New Camp</h3>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Camp name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Dubai Industrial Camp 1"
          className="input w-full"
        />
      </label>

      <p className="text-xs text-muted">This adds one of your own camps. Supplier and client camps are recorded when you check workers in, since you don&apos;t manage their rooms.</p>

      <label className="block max-w-[160px]">
        <span className="mb-1 block text-xs font-medium text-muted">How many rooms?</span>
        <NumberInput value={roomCount} onChange={(v) => changeRoomCount(Number(String(v)))} min={1} max={50} className="w-full" />
      </label>

      <div className="space-y-2">
        <span className="block text-xs font-medium text-muted">Beds in each room</span>
        <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
          {rooms.map((room, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-default p-2.5">
              <input
                value={room.name}
                onChange={(e) => updateRoom(i, { name: e.target.value })}
                placeholder={`Room ${i + 1} name`}
                className="input w-full px-2 py-1 text-sm"
              />
              <div className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-2">
                <label className="block">
                  <span className="mb-0.5 block text-[11px] font-medium text-muted">Single beds</span>
                  <NumberInput value={room.bedCount} onChange={(v) => updateRoom(i, { bedCount: Math.max(0, Math.min(20, Number(String(v)) || 0)) })} min={0} max={20} ariaLabel="Single beds in this room" />
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[11px] font-medium text-muted">Bunks (upper + lower)</span>
                  <NumberInput value={room.bunkCount} onChange={(v) => updateRoom(i, { bunkCount: Math.max(0, Math.min(20, Number(String(v)) || 0)) })} min={0} max={20} ariaLabel="Bunk beds in this room" />
                </label>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-subtle">
          {rooms.length} room{rooms.length === 1 ? "" : "s"}, {totalBeds} bed{totalBeds === 1 ? "" : "s"} total.
        </p>
      </div>

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || pending}
        className="btn btn-primary"
      >
        {pending ? "Creating…" : "Add Camp"}
      </button>
    </div>
  );
}
