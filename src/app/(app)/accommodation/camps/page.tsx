import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatTile } from "@/components/StatTile";
import { PageHeader } from "@/components/PageHeader";
import { BedDouble, Home, Percent, Building2 } from "lucide-react";
import { deleteCampAction } from "../actions";
import { CampView } from "./camp-view";
import { AddCampForm } from "./add-camp-form";
import { OccupancyRing } from "@/components/OccupancyRing";
import { DeleteButton } from "@/components/DeleteButton";
import { InlineEditRow } from "@/components/InlineEditRow";
import { Select } from "@/components/ui/Select";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { groupLookups } from "@/lib/lookups";
import { cn } from "@/lib/cn";
import { createRoomAction, updateCampAction } from "../actions";
import { NumberInput } from "@/components/ui/NumberInput";

export default async function CampsPage({
  searchParams,
}: {
  searchParams: Promise<{ campId?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { branchId } = await requireUserWithBranch();
  const [camps, lookupValues, suppliers] = await Promise.all([
    prisma.camp.findMany({
      include: {
        owningSupplier: { select: { name: true } },
        rooms: {
          include: { beds: { orderBy: { label: "asc" } } },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.lookupValue.findMany({
      where: { ...branchWhere(branchId), category: "ROOM_TYPE", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
      select: { category: true, value: true },
    }),
    prisma.supplier.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const roomTypeOptions = groupLookups(lookupValues).ROOM_TYPE;

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

  const occupants =
    campBedEmployeeIds.length > 0
      ? await prisma.employee.findMany({
          where: { id: { in: campBedEmployeeIds } },
          select: { id: true, name: true, employeeIdNo: true, photoMimeType: true },
        })
      : [];

  const unhoused = await prisma.employee.findMany({
    where: { ...branchWhere(branchId), bed: null, active: true, status: { not: "TERMINATED" } },
    select: { id: true, name: true, employeeIdNo: true, trade: true, photoMimeType: true },
    orderBy: { name: "asc" },
    take: 500,
  });

  const employeeNames = Object.fromEntries(
    occupants.map((e) => [e.id, { id: e.id, name: e.name, employeeIdNo: e.employeeIdNo, hasPhoto: !!e.photoMimeType }])
  );

  return (
    <div className="space-y-5">
      {params.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {params.error}
        </p>
      )}

      <PageHeader
        title="Camps"
        description="Manage camps, rooms and beds. Move employees in with Create Check-In and Bed Allocation."
        meta={
          <span className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-medium text-secondary">
            {camps.length} camp{camps.length === 1 ? "" : "s"}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total Beds" value={totalBeds} icon={BedDouble} />
        <StatTile label="Occupied" value={occupiedBeds} icon={Home} />
        <StatTile
          label="Occupancy"
          value={`${occupancyPct}%`}
          icon={Percent}
          hint={`${vacantBeds} bed${vacantBeds === 1 ? "" : "s"} vacant`}
        />
      </div>

      {totalBeds > 0 && (
        <div className="card relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-[var(--brand-primary)]/5" />
          <OccupancyRing occupied={occupiedBeds} vacant={vacantBeds} pct={occupancyPct} />
        </div>
      )}

      {camps.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {camps.map((c) => {
              const beds = c.rooms.flatMap((r) => r.beds);
              const occ = beds.filter((b) => b.employeeId).length;
              const active = c.id === selectedCamp?.id;
              return (
                <Link
                  key={c.id}
                  href={`/accommodation/camps?campId=${c.id}`}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium whitespace-nowrap transition",
                    active
                      ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)] shadow-xs"
                      : "border-default bg-surface text-secondary hover:border-strong hover:bg-surface-hover"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      c.ownerType === "SUPPLIER" ? "bg-amber-500" : "bg-blue-500"
                    )}
                    aria-hidden
                  />
                  {c.name}
                  <span className="tabular text-xs opacity-70">
                    {occ}/{beds.length}
                  </span>
                </Link>
              );
            })}
          </div>

          {selectedCamp && (
            <div className="card flex flex-wrap items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-[var(--brand-primary)]">
                <Building2 className="h-5 w-5" />
              </div>
              <InlineEditRow
                value={selectedCamp.name}
                action={updateCampAction}
                hiddenFields={{ campId: selectedCamp.id }}
              />
              <div className="ml-auto flex flex-wrap items-center gap-3">

                <DeleteButton
                  action={deleteCampAction}
                  hiddenFields={{ campId: selectedCamp.id }}
                  confirmMessage={`Delete ${selectedCamp.name}? All its rooms and beds will be removed, and anyone housed there will be unassigned.`}
                  label="Delete Camp"
                  className="rounded-control border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {selectedCamp ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-primary">
            {selectedCamp.name} — All Rooms
          </h2>
          <CampView
            rooms={selectedCamp.rooms.map((r) => ({
              id: r.id,
              name: r.name,
              roomType: r.roomType,
              nationality: r.nationality,
              beds: r.beds.map((b) => ({
                id: b.id,
                label: b.label,
                employeeId: b.employeeId,
              })),
            }))}
            employeeNames={employeeNames}
            unhoused={unhoused.map(({ photoMimeType, ...u }) => ({ ...u, hasPhoto: !!photoMimeType }))}
          />
        </div>
      ) : (
        <p className="empty-state py-10 text-sm text-muted">
          No camps yet — add one below to get started.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AddCampForm />

        {selectedCamp && (
          <form
            action={createRoomAction}
            className="card space-y-3 p-5"
          >
            <h3 className="text-sm font-semibold text-primary">
              Add Room to {selectedCamp.name}
            </h3>
            <input type="hidden" name="campId" value={selectedCamp.id} />
            <input
              name="name"
              required
              placeholder="Room name, e.g. Room 103"
              className="input w-full"
            />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-2">
              <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Single beds</span><NumberInput name="bedCount" defaultValue={4} min={0} max={20} className="w-full" /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Bunks (upper + lower)</span><NumberInput name="bunkCount" defaultValue={0} min={0} max={20} className="w-full" /></label>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Bed space</span>
                <NumberInput name="bedSpace" min={0} className="w-full" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Usable bed space</span>
                <NumberInput name="usableBedSpace" min={0} className="w-full" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Room type</span>
              <Select
                name="roomType"
                placeholder="Not set"
                options={roomTypeOptions.map((o) => ({ value: o.value, label: o.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Nationality targeting</span>
              <CountrySelect name="nationality" placeholder="Not set" />
            </label>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Add Room
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
