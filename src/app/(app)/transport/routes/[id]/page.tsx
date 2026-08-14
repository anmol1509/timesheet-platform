import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { DeleteButton } from "@/components/DeleteButton";
import { RouteForm } from "../route-form";
import { deleteRouteAction } from "../actions";

export default async function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [route, vehicles, projects] = await Promise.all([
    prisma.route.findUnique({
      where: { id },
      include: { stops: { orderBy: { stopOrder: "asc" } } },
    }),
    prisma.vehicle.findMany({ select: { id: true, plateNumber: true }, orderBy: { plateNumber: "asc" } }),
    prisma.project.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);
  if (!route) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/transport/routes" className="text-sm text-muted hover:underline">
          ← Routes
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl tracking-tight text-primary font-semibold">{route.name}</h1>
          <DeleteButton
            action={deleteRouteAction}
            hiddenFields={{ routeId: route.id }}
            confirmMessage={`Delete route "${route.name}"?`}
            label="Delete Route"
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          />
        </div>
      </div>

      <RouteForm
        vehicles={vehicles}
        projects={projects}
        route={{
          id: route.id,
          name: route.name,
          vehicleId: route.vehicleId,
          projectId: route.projectId,
          stops: route.stops.map((s) => ({ location: s.location, pickupTime: s.pickupTime, notes: s.notes })),
        }}
      />
    </div>
  );
}
