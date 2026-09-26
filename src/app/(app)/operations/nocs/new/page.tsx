import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { NocForm } from "./noc-form";

export default async function NewNocPage({
  searchParams,
}: {
  searchParams: Promise<{ demandRequestId?: string }>;
}) {
  const { demandRequestId } = await searchParams;
  const { branchId } = await requireUserWithBranch();

  const [demandRequests, templates] = await Promise.all([
    prisma.demandRequest.findMany({
      where: branchWhere(branchId),
      include: {
        client: true,
        project: true,
        trades: { include: { allocations: { include: { employee: true } } } },
      },
      orderBy: { requestNo: "desc" },
    }),
    prisma.letterTemplate.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
  ]);

  const requests = demandRequests.map((r) => {
    const employeeMap = new Map<string, { id: string; name: string; employeeIdNo: string }>();
    for (const trade of r.trades) {
      for (const a of trade.allocations) {
        employeeMap.set(a.employee.id, {
          id: a.employee.id,
          name: a.employee.name,
          employeeIdNo: a.employee.employeeIdNo,
        });
      }
    }
    return {
      id: r.id,
      requestNo: r.requestNo,
      clientName: r.client.name,
      projectName: r.project.name,
      employees: [...employeeMap.values()],
    };
  });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="New NOC"
        icon={FilePlus2}
        description={<>Generate a no-objection/mobilization letter for a subset of a Demand Request&apos;s allocated employees.</>}
      />
      <NocForm
        requests={requests}
        templates={templates.map((t) => ({ id: t.id, name: t.name }))}
        initialDemandRequestId={demandRequestId || ""}
      />
    </div>
  );
}
