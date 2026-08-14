import { Skeleton, TableSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-3.5 w-96" />
        </div>
        <Skeleton className="h-8 w-32 rounded-control" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-48 rounded-control" />
        <Skeleton className="ml-auto h-8 w-24 rounded-control" />
        <Skeleton className="h-8 w-24 rounded-control" />
      </div>
      <TableSkeleton rows={10} columns={7} />
    </div>
  );
}
