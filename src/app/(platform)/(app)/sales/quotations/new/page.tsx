import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { groupLookups } from "@/lib/lookups";
import { QuotationForm } from "./quotation-form";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ enquiryId?: string; clientId?: string }>;
}) {
  const { branchId } = await requireUserWithBranch();
  const params = await searchParams;
  const [clients, lookupValues] = await Promise.all([
    prisma.client.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.lookupValue.findMany({
      where: { ...branchWhere(branchId), category: "TRADE", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
      select: { category: true, value: true },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="New Quotation"
        icon={FilePlus2}
        description={<>Trade/quantity/rate line items for a client quotation.</>}
      />
      <QuotationForm
        clients={clients}
        tradeOptions={groupLookups(lookupValues).TRADE}
        defaultClientId={params.clientId || ""}
        enquiryId={params.enquiryId || ""}
      />
    </div>
  );
}
