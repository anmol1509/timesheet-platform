import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { ProjectList } from "./project-list";

export default async function ProjectsPage() {
  const { branchId } = await requireUserWithBranch();
  const projects = await prisma.project.findMany({
    where: branchWhere(branchId),
    include: { client: true, site: true },
    orderBy: { name: "asc" },
  });

  const rows = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    clientName: p.client.name,
    siteName: p.site?.name ?? null,
    manager: p.manager,
    timelineStart: p.timelineStart ? p.timelineStart.toISOString() : null,
    timelineEnd: p.timelineEnd ? p.timelineEnd.toISOString() : null,
    status: p.status,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track active work sites and who&rsquo;s managing them.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90"
        >
          + Add Project
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-slate-500">
            No projects yet.{" "}
            <Link href="/projects/new" className="font-medium text-slate-900 underline">
              Add one
            </Link>
            .
          </p>
        </div>
      ) : (
        <ProjectList projects={rows} />
      )}
    </div>
  );
}
