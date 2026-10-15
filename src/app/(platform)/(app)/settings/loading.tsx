import { Skeleton, FormSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-3.5 w-72" />
      </div>
      <FormSkeleton sections={2} fields={4} />
    </div>
  );
}
