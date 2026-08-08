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
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New NOC</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate a no-objection/mobilization letter for a subset of a Demand Request&apos;s allocated employees.
        </p>
      </div>
      <NocForm
        requests={requests}
        templates={templates.map((t) => ({ id: t.id, name: t.name }))}
        initialDemandRequestId={demandRequestId || ""}
      />
    </div>
  );
}
