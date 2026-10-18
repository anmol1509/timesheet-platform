import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireUserWithBranch } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { QuotationForm } from "../quotation-form";
import { loadQuotationFormData } from "../form-data";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ enquiryId?: string; clientId?: string }>;
}) {
  const { branchId } = await requireUserWithBranch();
  const params = await searchParams;
  const data = await loadQuotationFormData(branchId);
  // Coming from an enquiry, the client is already known.
  const fromEnquiry = params.enquiryId && !params.clientId ? await prisma.enquiry.findUnique({ where: { id: params.enquiryId }, select: { clientId: true, branchId: true } }) : null;
  const clientId = params.clientId || (fromEnquiry && data.clients.some((c) => c.id === fromEnquiry.clientId) ? fromEnquiry.clientId : "");

  return (
    <div className="space-y-5">
      <PageHeader
        title="New quotation"
        icon={FilePlus2}
        description={<>Price each line per month, day or hour. Costs, taxes and discounts are optional.</>}
      />
      <QuotationForm
        {...data}
        enquiryId={params.enquiryId || ""}
        initial={{
          clientId,
          contactId: "",
          validUntil: "",
          nextFollowUpAt: "",
          terms: "",
          coverIntro: "",
          coverClosing: "",
          accommodationResponsibility: "",
          transportationResponsibility: "",
          ppeResponsibility: "",
          currency: "AED",
          showCost: false,
          adjustments: [],
          lines: [],
        }}
      />
    </div>
  );
}
