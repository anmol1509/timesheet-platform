import { prisma } from "@/lib/db";
import { StatTile } from "@/components/StatTile";
import { BedDouble, Home } from "lucide-react";
import { createCampAction, createRoomAction } from "./actions";
import { BedGrid } from "./bed-grid";
import { OccupancyRing } from "@/components/OccupancyRing";

export default async function AccommodationPage({
  searchParams,
}: {
  searchParams: Promise<{ campId?: string; roomId?: string }>;
}) {
  const params = await searchParams;
  const camps = await prisma.camp.findMany({
    include: { rooms: { include: { beds: true } } },
    orderBy: { name: "asc" },
  });

  const allBeds = camps.flatMap((c) => c.rooms.flatMap((r) => r.beds));
  const totalBeds = allBeds.length;
  const occupiedBeds = allBeds.filter((b) => b.employeeId).length;
  const vacantBeds = totalBeds - occupiedBeds;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const selectedCamp =
    camps.find((c) => c.id === params.campId) || camps[0] || null;
  const selectedRoom =
    selectedCamp?.rooms.find((r) => r.id === params.roomId) ||
    selectedCamp?.rooms[0] ||
    null;

  const unassignedEmployees = await prisma.employee.findMany({
    where: { bed: null },
    select: { id: true, name: true, employeeIdNo: true, nationality: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Accommodation Management
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage bed assignments and accommodation status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total Beds" value={totalBeds} icon={BedDouble} />
        <StatTile label="Occupied" value={occupiedBeds} icon={Home} />
        <StatTile label="Vacant" value={vacantBeds} icon={BedDouble} />
      </div>

      {totalBeds > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <OccupancyRing occupied={occupiedBeds} vacant={vacantBeds} pct={occupancyPct} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <form className="flex items-end gap-2">
          <label className="block flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Camp
            </span>
            <select
              name="campId"
              defaultValue={selectedCamp?.id}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              {camps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Go
          </button>
        </form>
        <form className="flex items-end gap-2">
          <input type="hidden" name="campId" value={selectedCamp?.id} />
          <label className="block flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Room
            </span>
            <select
              name="roomId"
              defaultValue={selectedRoom?.id}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              {selectedCamp?.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.beds.length} beds)
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Go
          </button>
        </form>
      </div>

      {selectedRoom ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            {selectedRoom.name} — Bed Layout
          </h2>
          <BedGrid
            beds={selectedRoom.beds.map((b) => ({
              id: b.id,
              label: b.label,
              employeeId: b.employeeId,
            }))}
            employeeNames={await employeeNameMap(selectedRoom.beds.map((b) => b.employeeId))}
            unassignedEmployees={unassignedEmployees}
          />
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          {selectedCamp
            ? "This camp has no rooms yet — add one below."
            : "No camps yet — add one below to get started."}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form
          action={createCampAction}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h3 className="text-sm font-semibold text-slate-900">Add Camp</h3>
          <input
            name="name"
            required
            placeholder="Camp name, e.g. Dubai Industrial Camp 1"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Add Camp
          </button>
        </form>

        {selectedCamp && (
          <form
            action={createRoomAction}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h3 className="text-sm font-semibold text-slate-900">
              Add Room to {selectedCamp.name}
            </h3>
            <input type="hidden" name="campId" value={selectedCamp.id} />
            <input
              name="name"
              required
              placeholder="Room name, e.g. Room 103"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <input
              name="bedCount"
              type="number"
              min={1}
              max={20}
              defaultValue={4}
              placeholder="Number of beds"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Add Room
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

async function employeeNameMap(employeeIds: (string | null)[]) {
  const ids = employeeIds.filter((id): id is string => !!id);
  if (ids.length === 0) return {} as Record<string, { name: string; employeeIdNo: string }>;
  const employees = await prisma.employee.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, employeeIdNo: true },
  });
  return Object.fromEntries(
    employees.map((e) => [e.id, { name: e.name, employeeIdNo: e.employeeIdNo }])
  );
}
