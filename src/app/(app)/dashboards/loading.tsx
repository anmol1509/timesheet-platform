import { Skeleton, StatTileSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3.5 w-80" />
      </div>
      <StatTileSkeleton count={4} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="card p-4">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="mt-4 h-40 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
