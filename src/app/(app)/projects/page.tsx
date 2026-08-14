import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { ProjectList } from "./project-list";

export default async function ProjectsPage() {
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl tracking-tight text-primary font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-muted">
            Track active work sites and who&rsquo;s managing them.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="btn btn-primary"
        >
          + Add Project
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No projects yet"
          description="Projects are where workers get deployed and hours get billed. Create one to assign labour, track LPOs, and generate client timesheets."
          action={
            <Link href="/projects/new" className="btn btn-primary btn-sm">
              Add project
            </Link>
          }
        />
      ) : (
        <ProjectList projects={rows} />
      )}
    </div>
  );
}
