import { prisma } from "@/lib/db";
import { StatTile } from "@/components/StatTile";
import { BedDouble, Home } from "lucide-react";
import {
  createCampAction,
  createRoomAction,
  deleteCampAction,
  updateCampAction,
} from "./actions";
import { CampView } from "./camp-view";
import { OccupancyRing } from "@/components/OccupancyRing";
import { DeleteButton } from "@/components/DeleteButton";
import { InlineEditRow } from "@/components/InlineEditRow";

export default async function AccommodationPage({
  searchParams,
}: {
  searchParams: Promise<{ campId?: string }>;
}) {
  const params = await searchParams;
  const camps = await prisma.camp.findMany({
    include: {
      rooms: {
        include: { beds: { orderBy: { label: "asc" } } },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const allBeds = camps.flatMap((c) => c.rooms.flatMap((r) => r.beds));
  const totalBeds = allBeds.length;
  const occupiedBeds = allBeds.filter((b) => b.employeeId).length;
  const vacantBeds = totalBeds - occupiedBeds;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const selectedCamp =
    camps.find((c) => c.id === params.campId) || camps[0] || null;

  const campBedEmployeeIds =
    selectedCamp?.rooms.flatMap((r) =>
      r.beds.map((b) => b.employeeId).filter((id): id is string => !!id)
    ) ?? [];

  const [occupants, unassignedEmployees] = await Promise.all([
    campBedEmployeeIds.length > 0
      ? prisma.employee.findMany({
          where: { id: { in: campBedEmployeeIds } },
          select: { id: true, name: true, employeeIdNo: true },
        })
      : Promise.resolve([]),
    prisma.employee.findMany({
      where: { bed: null },
      select: { id: true, name: true, employeeIdNo: true, nationality: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const employeeNames = Object.fromEntries(
    occupants.map((e) => [e.id, { name: e.name, employeeIdNo: e.employeeIdNo }])
  );

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

      {camps.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-5">
          <form className="flex flex-1 items-end gap-2">
            <label className="block max-w-xs flex-1">
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
          {selectedCamp && (
            <>
              <InlineEditRow
                value={selectedCamp.name}
                action={updateCampAction}
                hiddenFields={{ campId: selectedCamp.id }}
              />
              <DeleteButton
                action={deleteCampAction}
                hiddenFields={{ campId: selectedCamp.id }}
                confirmMessage={`Delete ${selectedCamp.name}? All its rooms and beds will be removed, and anyone housed there will be unassigned.`}
                label="Delete Camp"
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              />
            </>
          )}
        </div>
      )}

      {selectedCamp ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            {selectedCamp.name} — All Rooms
          </h2>
          <CampView
            rooms={selectedCamp.rooms.map((r) => ({
              id: r.id,
              name: r.name,
              beds: r.beds.map((b) => ({
                id: b.id,
                label: b.label,
                employeeId: b.employeeId,
              })),
            }))}
            employeeNames={employeeNames}
            unassignedEmployees={unassignedEmployees}
          />
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          No camps yet — add one below to get started.
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
