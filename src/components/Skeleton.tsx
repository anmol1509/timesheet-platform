import { cn } from "@/lib/cn";

/** Shimmer placeholder. Shape it with width/height utilities. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} aria-hidden />;
}

/** Loading stand-in for a data table, matched to the real table's rhythm. */
export function TableSkeleton({
  rows = 8,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="card overflow-hidden" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex gap-4 border-b border-default bg-surface-subtle px-4 py-2.5">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-4 py-3">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn("h-3.5 flex-1", c === 0 && "max-w-24")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Loading stand-in for a row of KPI tiles. */
export function StatTileSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2.5 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Loading stand-in for a stack of form sections. */
export function FormSkeleton({ sections = 2, fields = 6 }: { sections?: number; fields?: number }) {
  return (
    <div className="space-y-4" aria-busy="true">
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="card card-padded">
          <Skeleton className="h-3.5 w-32" />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: fields }).map((_, f) => (
              <div key={f}>
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="mt-2 h-9" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
