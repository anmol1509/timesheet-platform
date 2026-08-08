import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { groupLookups } from "@/lib/lookups";
import { DemandRequestForm } from "./demand-request-form";

export default async function NewDemandRequestPage() {
  const { branchId } = await requireUserWithBranch();
  const [clients, projects, lookupValues] = await Promise.all([
    prisma.client.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true, code: true, clientId: true, salesExecutive: true },
      orderBy: { name: "asc" },
    }),
    prisma.lookupValue.findMany({
      where: { ...branchWhere(branchId), category: "TRADE", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
      select: { category: true, value: true },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Demand Request</h1>
        <p className="mt-1 text-sm text-slate-500">
          Request staffing for a client project, broken down by trade.
        </p>
      </div>
      <DemandRequestForm clients={clients} projects={projects} tradeOptions={groupLookups(lookupValues).TRADE} />
    </div>
  );
}
