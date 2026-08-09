import Link from "next/link";
import { prisma } from "@/lib/db";
import { RouteList } from "./route-list";

export default async function RoutesPage() {
  const routes = await prisma.route.findMany({
    include: { vehicle: true, project: true, stops: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Routes</h1>
          <p className="mt-1 text-sm text-slate-500">Named pickup routes with ordered stops, driven by a vehicle.</p>
        </div>
        <Link
          href="/transport/routes/new"
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          + New Route
        </Link>
      </div>

      {routes.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No routes yet.
        </p>
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
