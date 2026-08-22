import Link from "next/link";
import { MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { EmptyState } from "@/components/EmptyState";
import { DeleteButton } from "@/components/DeleteButton";
import { createSiteAction, deleteSiteAction } from "./actions";
import { Select } from "@/components/ui/Select";

/**
 * Sites, grouped under the project they belong to.
 *
 * A site is where work physically happens — the level below a project, and
 * what attendance and timesheets are actually filtered by on the ground. The
 * client comes through the project rather than being stored again on the site.
 */
export default async function SitesPage() {
  const { branchId } = await requireUserWithBranch();

  const projects = await prisma.project.findMany({
    where: branchWhere(branchId),
    select: {
      id: true,
      code: true,
      name: true,
      client: { select: { name: true } },
      sites: {
        select: {
          id: true,
          name: true,
          address: true,
          _count: { select: { employees: true, timesheetEntries: true } },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const siteCount = projects.reduce((sum, p) => sum + p.sites.length, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Sites</h1>
        <p className="mt-1 text-sm text-muted">
          Where work actually happens. Each site sits under a project, and takes its
          client from that project.
        </p>
      </div>

      <form action={createSiteAction} className="card flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[16rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Project</span>
          <Select
            name="projectId"
            placeholder="Select project"
            options={projects.map((p) => ({
              value: p.id,
              label: `${p.code} — ${p.name}${p.client ? ` · ${p.client.name}` : ""}`,
            }))}
          />
        </label>
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Site name</span>
          <input name="name" required placeholder="e.g. WA DIC" className="input w-full" />
        </label>
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Address (optional)</span>
          <input name="address" className="input w-full" />
        </label>
        <button type="submit" className="btn btn-primary">
          Add Site
        </button>
      </form>

      {siteCount === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No sites yet"
          description="Add a site above and it will appear under its project."
        />
      ) : (
        <div className="space-y-4">
          {projects
            .filter((p) => p.sites.length > 0)
            .map((project) => (
              <div key={project.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-default bg-surface-subtle px-4 py-2.5">
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {project.code} — {project.name}
                  </Link>
                  <span className="text-xs text-muted">
                    {project.client?.name ?? "No client"} · {project.sites.length} site
                    {project.sites.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {project.sites.map((site) => {
                    const inUse =
                      site._count.employees > 0 || site._count.timesheetEntries > 0;
                    return (
                      <li key={site.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-primary">
                            {site.name}
                          </span>
                          {site.address && (
                            <span className="block truncate text-xs text-subtle">
                              {site.address}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted">
                          {site._count.employees} worker
                          {site._count.employees === 1 ? "" : "s"}
                        </span>
                        {inUse ? (
                          <span
                            className="text-xs text-subtle"
                            title="In use by workers or timesheet rows — clear those first"
                          >
                            In use
                          </span>
                        ) : (
                          <DeleteButton
                            action={deleteSiteAction}
                            hiddenFields={{ siteId: site.id }}
                            confirmMessage={`Delete site "${site.name}"?`}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
