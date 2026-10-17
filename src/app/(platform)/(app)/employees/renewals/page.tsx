import { CalendarClock } from "lucide-react";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { requireUserWithBranch } from "@/lib/auth";
import { getRenewals, summarise } from "@/lib/renewals";
import { RenewalsBoard } from "./renewals-board";

export default async function RenewalsPage() {
  const { branchId } = await requireUserWithBranch();
  const items = await getRenewals(branchId);
  const counts = summarise(items);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Renewals"
        icon={CalendarClock}
        breadcrumbs={[{ label: "Workforce", href: "/employees" }, { label: "Renewals" }]}
        meta={<CountPill>{items.length}</CountPill>}
        description="Visas, labour cards, passports, Emirates IDs, medicals, and suppliers' trade licences and workmen's compensation falling due in the next 90 days — worst first, so long-lead renewals start in time."
      />
      <RenewalsBoard items={items} counts={counts} />
    </div>
  );
}
