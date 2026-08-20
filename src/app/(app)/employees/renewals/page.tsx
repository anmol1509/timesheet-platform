import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/Badge";
import { requireUserWithBranch } from "@/lib/auth";
import { getRenewals, summarise, RENEWAL_TIERS, type RenewalTier } from "@/lib/renewals";

const TIER_COLOR: Record<RenewalTier, "red" | "amber" | "slate"> = {
  expired: "red",
  urgent: "red",
  soon: "amber",
  planned: "slate",
  horizon: "slate",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function RenewalsPage() {
  const { branchId } = await requireUserWithBranch();
  const items = await getRenewals(branchId);
  const counts = summarise(items);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Renewals</h1>
        <p className="mt-1 text-sm text-muted">
          Visas, labour cards, passports, Emirates IDs, medicals and suppliers&rsquo;
          workmen&rsquo;s compensation falling due in the next 90 days — worst first, so the long-lead ones can be started in
          time.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {RENEWAL_TIERS.map((tier) => (
          <div key={tier.key} className="card card-padded">
            <p className="text-xs text-muted">{tier.label}</p>
            <p className="tabular mt-1 text-2xl font-semibold text-primary">
              {counts[tier.key]}
            </p>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing due in the next 90 days"
          description="Every tracked document on the active roster is valid beyond the horizon."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Employee / Supplier</th>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Runway</th>
                  <th className="px-4 py-3">Deployment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {items.map((item) => (
                  <tr key={`${item.kind}-${item.subjectId}-${item.document}`}>
                    <td className="px-4 py-3">
                      <Link
                        href={
                          item.kind === "employee"
                            ? `/employees/${item.subjectId}`
                            : `/suppliers/${item.subjectId}`
                        }
                        className="font-medium text-primary hover:underline"
                      >
                        {item.subjectName}
                      </Link>
                      <span className="tabular ml-2 text-xs text-subtle">
                        {item.subjectRef}
                      </span>
                      {item.kind === "supplier" && (
                        <span className="ml-2 rounded-control bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-secondary">
                          Supplier
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondary">{item.document}</td>
                    <td className="tabular px-4 py-3 text-secondary">
                      {fmt(item.expiry)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={TIER_COLOR[item.tier]}>
                        {item.days < 0
                          ? `${Math.abs(item.days)} days overdue`
                          : `${item.days} days`}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {item.project || item.supplier || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
