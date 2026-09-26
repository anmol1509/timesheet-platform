import { Tent } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { KpiStrip } from "@/components/KpiStrip";
import { Panel } from "@/components/DashboardPanel";
import { StatusBreakdown } from "@/components/StatusBreakdown";
import { OccupancyRing } from "@/components/OccupancyRing";

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
  const occupancyPct =
    totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const totalVehicles = vehicles.reduce((sum, v) => sum + v._count._all, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Tent}
        title="Facilities overview"
        description="Camps, bed occupancy and the vehicle fleet."
      />
      <DashboardTabs />

      <KpiStrip
        cells={[
          {
            label: "Camps",
            value: campCount,
            sub: "managed sites",
            href: "/accommodation/camps",
          },
          {
            label: "Occupancy",
            value: occupancyPct,
            suffix: "%",
            sub: `${vacantBeds} beds vacant`,
            href: "/accommodation/bed-allocation",
            meter: occupancyPct,
          },
          {
            label: "Awaiting bed",
            value: awaitingBed,
            sub: "checked in, no bed",
            href: "/accommodation/bed-allocation",
            tone: awaitingBed > 0 ? ("warning" as const) : ("default" as const),
          },
          {
            label: "Vehicles",
            value: totalVehicles,
            sub: "in the fleet",
            href: "/transport",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {totalBeds > 0 && (
          <Panel title="Camp occupancy" href="/accommodation/camps">
            <OccupancyRing
              occupied={occupiedBeds}
              vacant={vacantBeds}
              pct={occupancyPct}
            />
          </Panel>
        )}

        <Panel title="Vehicles by status" href="/transport">
          <StatusBreakdown
            items={vehicles.map((v) => ({
              status: v.status,
              count: v._count._all,
            }))}
            unit="vehicles"
            emptyMessage="No vehicles registered."
          />
        </Panel>
      </div>
    </div>
  );
}
