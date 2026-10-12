import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { TRADES } from "@/lib/trades";
import { DemandRequestForm } from "./demand-request-form";

export default async function NewDemandRequestPage() {
  const { branchId } = await requireUserWithBranch();
  const [clients, projects] = await Promise.all([
    prisma.client.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true, code: true, clientId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // The closed trade list, not whatever strings happen to be on the roster:
  // a demand for a trade nobody is recorded under can't be matched.
  const tradeOptions = [...TRADES];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raise Demand"
        icon={FilePlus2}
        description={<>Request staffing for a client project, broken down by trade.</>}
      />
      <DemandRequestForm clients={clients} projects={projects} tradeOptions={tradeOptions} />
    </div>
  );
}
