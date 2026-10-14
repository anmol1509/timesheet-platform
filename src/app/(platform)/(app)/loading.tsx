import { Skeleton } from "@/components/Skeleton";

/**
 * Default loading UI for every authenticated route, including the dashboard at
 * the segment root. Deliberately shape-neutral — a page masthead plus a couple
 * of content blocks — because this one boundary covers both the dashboard and
 * the list pages. Routes whose shape differs sharply (the big list screens)
 * ship their own loading.tsx alongside their page.
 */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <Skeleton className="h-8 w-32 rounded-control" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2.5 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="card-header">
            <Skeleton className="h-3.5 w-40" />
          </div>
          <div className="p-5">
            <Skeleton className="h-48" />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <Skeleton className="h-3.5 w-28" />
          </div>
          <div className="divide-y divide-[var(--border)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
