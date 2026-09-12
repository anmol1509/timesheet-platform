import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { StatTile } from "@/components/StatTile";
import { Panel } from "@/components/DashboardPanel";
import { OccupancyRing } from "@/components/OccupancyRing";
import { Badge } from "@/components/Badge";
import { BedDouble, Bus, Home, LogIn } from "lucide-react";

export default async function FacilitiesDashboardPage() {
  // Camp/Room/Bed/Vehicle aren't branch-scoped (deliberate, see Facilities
  // module history), so this dashboard stays cross-branch like the main one.
  const [beds, vehicles, campCount, awaitingBed] = await Promise.all([
    prisma.bed.findMany({ select: { employeeId: true } }),
    prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.camp.count(),
    prisma.campCheckIn.count({ where: { status: "CHECKED_IN" } }),
  ]);

  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.employeeId).length;
  const vacantBeds = totalBeds - occupiedBeds;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const totalVehicles = vehicles.reduce((sum, v) => sum + v._count._all, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description="Accommodation occupancy and transport status." />
      <DashboardTabs />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile href="/accommodation/camps" label="Camps" value={campCount} icon={Home} />
        <StatTile href="/accommodation/bed-allocation" label="Occupancy" value={`${occupancyPct}%`} icon={BedDouble} hint={`${vacantBeds} vacant`} />
        <StatTile
          href="/accommodation/bed-allocation"
          label="Awaiting Bed"
          value={awaitingBed}
          icon={LogIn}
          tone={awaitingBed > 0 ? "warning" : "default"}
        />
        <StatTile href="/transport" label="Vehicles" value={totalVehicles} icon={Bus} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {totalBeds > 0 && (
          <Panel title="Camp occupancy" href="/accommodation/camps">
            <OccupancyRing occupied={occupiedBeds} vacant={vacantBeds} pct={occupancyPct} />
          </Panel>
        )}

        <Panel title="Vehicles by status" href="/transport">
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted">No vehicles registered.</p>
          ) : (
            <ul className="space-y-1.5">
              {vehicles.map((v) => (
                <li key={v.status} className="flex items-center justify-between text-sm">
                  <Badge color={v.status === "ACTIVE" ? "green" : v.status === "MAINTENANCE" ? "amber" : "slate"}>
                    {v.status}
                  </Badge>
                  <span className="tabular font-semibold text-primary">{v._count._all}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
