import { PageHeader } from "@/components/PageHeader";
import { MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { createSiteAction } from "./actions";
import { SiteTable } from "./site-table";
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


  return (
    <div className="space-y-5">
      <PageHeader
        title="Sites"
        icon={MapPin}
        description={<>Where work actually happens. Each site sits under a project, and takes its client from that project.</>}
      />

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
          <span className="mb-1 block text-xs font-medium text-muted">Site name *</span>
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

      <SiteTable
          sites={projects.flatMap((p) =>
            p.sites.map((site) => ({
              id: site.id,
              name: site.name,
              address: site.address,
              projectId: p.id,
              projectCode: p.code,
              projectName: p.name,
              clientName: p.client?.name ?? null,
              workers: site._count.employees,
              timesheetRows: site._count.timesheetEntries,
            })),
          )}
        />
    </div>
  );
}
