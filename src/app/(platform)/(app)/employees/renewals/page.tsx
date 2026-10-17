import { CalendarClock } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { requireUserWithBranch } from "@/lib/auth";
import { getRenewals, summarise } from "@/lib/renewals";
import { RenewalsBoard } from "./renewals-board";

export default async function RenewalsPage() {
  const { branchId } = await requireUserWithBranch();
  const items = await getRenewals(branchId);
  const counts = summarise(items);

  return (
    <div className="space-y-6">
      <HeroHeader
        icon={CalendarClock}
        title="Renewals"
        subtitle="Visas, labour cards, passports, Emirates IDs, medicals and supplier licences falling due in the next 90 days, worst first."
        pills={[
          { label: "Due in 90 days", value: String(items.length) },
          { label: "Expired", value: String(counts.expired), warn: counts.expired > 0 },
          { label: "Next 7 days", value: String(counts.urgent), warn: counts.urgent > 0 },
          { label: "Supplier licences", value: String(items.filter((i) => i.kind === "supplier").length) },
        ]}
      />
      <RenewalsBoard items={items} counts={counts} />
    </div>
  );
}
