import { ClipboardList, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { ProjectList } from "./project-list";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { branchId } = await requireUserWithBranch();
  const projects = await prisma.project.findMany({
    where: branchWhere(branchId),
    include: { client: true },
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
    timelineStart: p.timelineStart ? p.timelineStart.toISOString() : null,
    timelineEnd: p.timelineEnd ? p.timelineEnd.toISOString() : null,
    status: p.status,
  }));

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <PageHeader
        title="Projects"
        description="Track active work sites and who's managing them."
        meta={
          <span className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-medium text-secondary">
            {rows.length}
          </span>
        }
        actions={
          <Button href="/projects/new" size="sm">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add project
          </Button>
        }
      />

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
