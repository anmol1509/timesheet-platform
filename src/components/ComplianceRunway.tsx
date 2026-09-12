import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { ComplianceRunway as Runway, RunwayBucketKey } from "@/lib/complianceRunway";
import { cn } from "@/lib/cn";

// Severity reads left to right: expired is the only red, and the horizon
// cools off as the runway lengthens.
const BAR: Record<RunwayBucketKey, string> = {
  expired: "bg-[var(--error)]",
  d30: "bg-[var(--warning)]",
  d60: "bg-[var(--info)]",
  d90: "bg-[var(--border-strong)]",
};

const SWATCH: Record<RunwayBucketKey, string> = {
  expired: "bg-[var(--error-soft)] text-[var(--error)]",
  d30: "bg-[var(--warning-soft)] text-[var(--warning)]",
  d60: "bg-[var(--info-soft)] text-[var(--info)]",
  d90: "bg-surface-sunken text-secondary",
};

/**
 * Document expiries over the next 90 days: totals per bucket, then one
 * stacked bar per document type so it's obvious which document is driving
 * the workload rather than only how much there is.
 */
export function ComplianceRunway({ runway }: { runway: Runway }) {
  if (runway.total === 0) {
    return (
      <div className="flex flex-col items-center px-5 py-10 text-center">
        <CheckCircle2 className="mb-2 h-5 w-5 text-[var(--success)]" aria-hidden />
        <p className="text-sm font-medium text-primary">All clear</p>
        <p className="mt-1 text-xs text-muted">
          No worker documents expire in the next 90 days.
        </p>
      </div>
    );
  }

  const widest = Math.max(...runway.documents.map((d) => d.total));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {runway.buckets.map((bucket) => (
          <div key={bucket.key} className={cn("rounded-control px-3 py-2", SWATCH[bucket.key])}>
            <p className="tabular text-xl font-semibold">{bucket.count}</p>
            <p className="mt-0.5 text-[11px] font-medium">{bucket.label}</p>
          </div>
        ))}
      </div>

      <ul className="space-y-2.5">
        {runway.documents.map((doc) => (
          <li key={doc.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-medium text-secondary">{doc.label}</span>
              <span className="tabular shrink-0 text-xs text-muted">{doc.total}</span>
            </div>
            <div
              className="mt-1 flex h-2 overflow-hidden rounded-full bg-surface-sunken"
              style={{ width: `${Math.max(8, Math.round((doc.total / widest) * 100))}%` }}
            >
              {(["expired", "d30", "d60", "d90"] as RunwayBucketKey[]).map((key) =>
                doc[key] > 0 ? (
                  <span
                    key={key}
                    className={BAR[key]}
                    style={{ width: `${(doc[key] / doc.total) * 100}%` }}
                    title={`${doc[key]} ${key === "expired" ? "expired" : "expiring"}`}
                  />
                ) : null
              )}
            </div>
          </li>
        ))}
      </ul>

      <Link
        href="/employees/renewals"
        className="inline-flex items-center text-xs font-medium text-[var(--brand-primary)] hover:underline"
      >
        Plan renewals →
      </Link>
    </div>
  );
}
