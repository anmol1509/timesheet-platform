import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { NewEnquiryForm } from "./new-enquiry-form";

export default async function NewEnquiryPage() {
  const { branchId } = await requireUserWithBranch();
  const clients = await prisma.client.findMany({
    where: branchWhere(branchId),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="New Enquiry"
        icon={FilePlus2}
        description={<>Capture a client enquiry or RFQ.</>}
      />
      <NewEnquiryForm clients={clients} />
    </div>
  );
}
