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
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">New Enquiry</h1>
        <p className="mt-1 text-sm text-muted">Capture a client enquiry or RFQ.</p>
      </div>
      <NewEnquiryForm clients={clients} />
    </div>
  );
}
