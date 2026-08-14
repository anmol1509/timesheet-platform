import Link from "next/link";
import { FileText, Building2, ClipboardList, Truck } from "lucide-react";
import type { DocumentExpiryCategory } from "@/lib/documentExpiryCounts";
import { Badge } from "@/components/Badge";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Employee Documents": FileText,
  "Client Documents": Building2,
  "Project Documents": ClipboardList,
  "Supplier Documents": Truck,
};

const HREFS: Record<string, string> = {
  "Employee Documents": "/documents",
  "Client Documents": "/clients",
  "Project Documents": "/projects",
  "Supplier Documents": "/suppliers",
};

export function DocumentExpiryWidget({
  categories,
}: {
  categories: DocumentExpiryCategory[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((c) => {
        const Icon = ICONS[c.category] ?? FileText;
        const hasIssues = c.expired > 0 || c.expiringSoon > 0;
        return (
          <Link
            key={c.category}
            href={HREFS[c.category] ?? "/documents"}
            className="block rounded-2xl border border-default bg-surface p-4 transition hover:border-strong hover:shadow-md"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-muted">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted">{c.category}</p>
                <p className="text-lg font-semibold text-primary">{c.total}</p>
              </div>
            </div>
            {hasIssues && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.expired > 0 && <Badge color="red">{c.expired} expired</Badge>}
                {c.expiringSoon > 0 && <Badge color="amber">{c.expiringSoon} expiring</Badge>}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
