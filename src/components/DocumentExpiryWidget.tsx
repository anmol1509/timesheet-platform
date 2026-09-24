import Link from "next/link";
import type { DocumentExpiryCategory } from "@/lib/documentExpiryCounts";
import { cn } from "@/lib/cn";

const HREFS: Record<string, string> = {
  "Employee Documents": "/documents",
  "Client Documents": "/clients",
  "Project Documents": "/projects",
  "Supplier Documents": "/suppliers",
};

/**
 * One divided card rather than four boxes with icons — same shape as the KPI
 * strip. The count is the headline; expired/expiring only appear when non-zero,
 * so a healthy category is just quiet.
 */
export function DocumentExpiryWidget({
  categories,
}: {
  categories: DocumentExpiryCategory[];
}) {
  return (
    <div className="card grid grid-cols-2 divide-x divide-y divide-[var(--border)] overflow-hidden lg:grid-cols-4 lg:divide-y-0">
      {categories.map((c) => (
        <Link
          key={c.category}
          href={HREFS[c.category] ?? "/documents"}
          className="block p-4 transition hover:bg-surface-hover"
        >
          <p className="truncate text-[13px] font-medium text-muted">{c.category}</p>
          <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-primary">{c.total}</p>
          <p
            className={cn(
              "mt-1.5 text-xs",
              c.expired > 0
                ? "font-medium text-[var(--error)]"
                : c.expiringSoon > 0
                  ? "font-medium text-[var(--warning)]"
                  : "text-subtle"
            )}
          >
            {c.expired > 0
              ? `${c.expired} expired${c.expiringSoon > 0 ? ` · ${c.expiringSoon} expiring` : ""}`
              : c.expiringSoon > 0
                ? `${c.expiringSoon} expiring soon`
                : "All valid"}
          </p>
        </Link>
      ))}
    </div>
  );
}
