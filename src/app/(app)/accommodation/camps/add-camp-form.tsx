"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { createCampWithRoomsAction } from "../actions";

type RoomDraft = { name: string; bedCount: number };
type SupplierOption = { id: string; name: string };

function defaultRooms(count: number, previous: RoomDraft[]): RoomDraft[] {
  return Array.from({ length: count }, (_, i) => previous[i] ?? { name: `Room ${i + 1}`, bedCount: 4 });
}

export function AddCampForm({ suppliers }: { suppliers: SupplierOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ownerType, setOwnerType] = useState<"OWN" | "SUPPLIER">("OWN");
  const [supplierId, setSupplierId] = useState("");
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

  const totalBeds = rooms.reduce((sum, r) => sum + r.bedCount, 0);
  const canSubmit = name.trim().length > 0 && rooms.every((r) => r.name.trim().length > 0);

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("ownerType", ownerType);
    if (ownerType === "SUPPLIER" && supplierId) formData.append("supplierId", supplierId);
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

      <div>
        <span className="mb-1 block text-xs font-medium text-muted">Camp type</span>
        <SegmentedControl
          value={ownerType}
          onChange={(v) => setOwnerType(v as "OWN" | "SUPPLIER")}
          options={[
            { value: "OWN", label: "Own camp" },
            { value: "SUPPLIER", label: "Supplier camp" },
          ]}
        />
      </div>

      {ownerType === "SUPPLIER" && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Owning supplier</span>
          <Select
            value={supplierId}
            onChange={setSupplierId}
            placeholder="Select a supplier"
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />
        </label>
      )}

      <label className="block max-w-[160px]">
        <span className="mb-1 block text-xs font-medium text-muted">How many rooms?</span>
        <input
          type="number"
          min={1}
          max={50}
          value={roomCount}
          onChange={(e) => changeRoomCount(Number(e.target.value))}
          className="input w-full"
        />
      </label>

      <div className="space-y-2">
        <span className="block text-xs font-medium text-muted">Beds in each room</span>
        <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
          {rooms.map((room, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-default p-2">
              <input
                value={room.name}
                onChange={(e) => updateRoom(i, { name: e.target.value })}
                placeholder={`Room ${i + 1} name`}
                className="input min-w-0 flex-1 px-2 py-1 text-sm"
              />
              <input
                type="number"
                min={1}
                max={20}
                value={room.bedCount}
                onChange={(e) => updateRoom(i, { bedCount: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                className="input w-16 px-2 py-1 text-sm"
                title="Beds in this room"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-subtle">
          {rooms.length} room{rooms.length === 1 ? "" : "s"}, {totalBeds} bed{totalBeds === 1 ? "" : "s"} total.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
