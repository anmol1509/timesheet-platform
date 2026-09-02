import { UserMinus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { EmptyState } from "@/components/EmptyState";
import { ON_WORK_STAGES } from "@/lib/employeeStage";
import { DemobilisationBoard } from "./demobilisation-board";

/**
 * Taking workers off a job — the closing half of the mobilisation cycle.
 *
 * Deployed means on a project and in one of the working stages: a worker on the
 * bench has nothing to be demobilised from, and one already off the books is
 * gone. The second tab is the record of what has come off, read from the same
 * assignment history the profile shows rather than a list of its own.
 */
export default async function DemobilisationPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; projectId?: string }>;
}) {
  const params = await searchParams;
  const { branchId } = await requireUserWithBranch();

  const [deployed, clients, projects, recent] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...branchWhere(branchId),
        active: true,
        projectId: { not: null },
        status: { in: [...ON_WORK_STAGES] },
        ...(params.projectId ? { projectId: params.projectId } : {}),
        ...(params.clientId ? { project: { clientId: params.clientId } } : {}),
      },
      select: {
        id: true,
        name: true,
        employeeIdNo: true,
        trade: true,
        status: true,
        mobilisationDate: true,
        siteArrivalDate: true,
        supplier: { select: { name: true } },
        site: { select: { name: true } },
        project: { select: { id: true, name: true, code: true, clientId: true, client: { select: { name: true } } } },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.client.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true, code: true, clientId: true },
      orderBy: { name: "asc" },
    }),
    prisma.employeeAssignmentHistory.findMany({
      where: {
        demobilizedDate: { not: null },
        employee: branchWhere(branchId),
      },
      select: {
        id: true,
        projectName: true,
        mobilizedDate: true,
        demobilizedDate: true,
        demobilizationReason: true,
        demobilizedByName: true,
        employee: {
          select: { id: true, name: true, employeeIdNo: true, trade: true, active: true },
        },
      },
      orderBy: { demobilizedDate: "desc" },
      take: 50,
    }),
  ]);

  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Demobilisation</h1>
        <p className="mt-1 text-sm text-muted">
          Take workers off a job. Ends the placement everywhere at once — the
          stage, the project, the demand allocation and the assignment record.
        </p>
      </div>

      {deployed.length === 0 && recent.length === 0 ? (
        <EmptyState
          icon={UserMinus}
          title="Nobody is deployed"
          description="Workers appear here once they are mobilised onto a project."
        />
      ) : (
        <DemobilisationBoard
          clientId={params.clientId ?? ""}
          projectId={params.projectId ?? ""}
          clients={clients}
          projects={projects.map((p) => ({
            id: p.id,
            label: `${p.code} — ${p.name}`,
            clientId: p.clientId,
          }))}
          deployed={deployed.map((e) => ({
            id: e.id,
            name: e.name,
            employeeIdNo: e.employeeIdNo,
            trade: e.trade,
            status: e.status,
            supplierName: e.supplier?.name ?? null,
            siteName: e.site?.name ?? null,
            clientName: e.project?.client.name ?? null,
            projectLabel: e.project ? `${e.project.code} — ${e.project.name}` : null,
            since: iso(e.siteArrivalDate ?? e.mobilisationDate),
          }))}
          recent={recent.map((h) => ({
            id: h.id,
            employeeId: h.employee.id,
            name: h.employee.name,
            employeeIdNo: h.employee.employeeIdNo,
            trade: h.employee.trade,
            stillEmployed: h.employee.active,
            projectName: h.projectName,
            mobilizedDate: iso(h.mobilizedDate),
            demobilizedDate: iso(h.demobilizedDate),
            reason: h.demobilizationReason,
            byName: h.demobilizedByName,
          }))}
        />
      )}
    </div>
  );
}
