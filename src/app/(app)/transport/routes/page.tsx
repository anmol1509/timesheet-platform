import Link from "next/link";
import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { RouteList } from "./route-list";

export default async function RoutesPage() {
  const routes = await prisma.route.findMany({
    include: { vehicle: true, project: true, stops: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl tracking-tight text-primary font-semibold">Routes</h1>
          <p className="mt-1 text-sm text-muted">Named pickup routes with ordered stops, driven by a vehicle.</p>
        </div>
        <Link
          href="/transport/routes/new"
          className="btn btn-primary"
        >
          + New Route
        </Link>
      </div>

      {routes.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No routes yet"
          description="A route is an ordered set of pickup stops served by one vehicle. Create one to plan daily site transport."
          action={
            <Link href="/transport/routes/new" className="btn btn-primary btn-sm">New route</Link>
          }
        />
      ) : (
        <RouteList
          routes={routes.map((r) => ({
            id: r.id,
            name: r.name,
            vehiclePlate: r.vehicle.plateNumber,
            projectName: r.project?.name ?? null,
            stopCount: r.stops.length,
          }))}
        />
      )}
    </div>
  );
}
