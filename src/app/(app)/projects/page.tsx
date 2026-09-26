import { ClipboardList, FolderKanban, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { KpiStrip } from "@/components/KpiStrip";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { ProjectList } from "./project-list";

function daysUntil(d: Date | null) {
  return d ? Math.ceil((d.getTime() - Date.now()) / 86_400_000) : null;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { branchId } = await requireUserWithBranch();
  const projects = await prisma.project.findMany({
    where: branchWhere(branchId),
    include: {
      client: true,
      _count: { select: { employees: true, sites: true } },
      demandRequests: { where: { status: "Open" }, select: { id: true } },
      lpos: { where: { status: "ACTIVE" }, select: { value: true, billedAmount: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    clientName: p.client.name,
    address: p.address,
    manager: p.manager,
    managerPhone: p.managerPhone,
    managerEmail: p.managerEmail,
    coordinator: p.projectCoordinator,
    coordinatorPhone: p.projectCoordinatorPhone,
    salesExecutive: p.salesExecutive,
    salesExecutivePhone: p.salesExecutivePhone,
    timelineStart: p.timelineStart ? p.timelineStart.toISOString() : null,
    timelineEnd: p.timelineEnd ? p.timelineEnd.toISOString() : null,
    status: p.status,
    deployed: p._count.employees,
    required: p.noOfEmployeesRequired,
    sites: p._count.sites,
    openDemands: p.demandRequests.length,
    lpoCount: p.lpos.length,
    lpoValue: p.lpos.reduce((n, l) => n + (l.value ?? 0), 0),
    lpoBilled: p.lpos.reduce((n, l) => n + l.billedAmount, 0),
    daysLeft: daysUntil(p.timelineEnd),
  }));

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-2 text-sm text-[var(--error)]">
          {error}
        </p>
      )}
      <PageHeader
        title="Projects"
        icon={FolderKanban}
        description="Track active work sites, their workforce, demand and billing."
        meta={<CountPill>{rows.length}</CountPill>}
        actions={
          <Button href="/projects/new" size="sm">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add project
          </Button>
        }
      />

      {rows.length > 0 && (
        <KpiStrip
          cells={[
            { label: "Active projects", value: rows.filter((r) => r.status === "ACTIVE").length, sub: `${rows.length} projects in total`, href: "/dashboards/projects" },
            { label: "Deployed workforce", value: rows.reduce((n, r) => n + r.deployed, 0), sub: `${rows.reduce((n, r) => n + (r.required ?? 0), 0)} required across projects`, href: "/employees?filter=on-work" },
            { label: "Open demand", value: rows.reduce((n, r) => n + r.openDemands, 0), sub: "labour requests being filled", href: "/demand" },
            {
              label: "Ending within 30 days",
              value: rows.filter((r) => r.status === "ACTIVE" && r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 30).length,
              sub: "active projects near their end date",
              href: "/dashboards/projects",
              tone: rows.some((r) => r.status === "ACTIVE" && r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 30) ? "warning" : "default",
            },
          ]}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No projects yet"
          description="Projects are where workers get deployed and hours get billed. Create one to assign labour, track LPOs, and generate client timesheets."
          action={
            <Button href="/projects/new" size="sm">
              Add project
            </Button>
          }
        />
      ) : (
        <ProjectList projects={rows} />
      )}
    </div>
  );
}
