import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { canWrite } from "@/lib/permissions";
import { SitesBoard } from "./sites-board";

export const metadata = { title: "Sites" };

/**
 * Sites, grouped under the project they belong to.
 *
 * A site is where work physically happens — the level below a project, and
 * what attendance and timesheets are actually filtered by on the ground. The
 * client comes through the project rather than being stored again on the site.
 */
export default async function SitesPage() {
  const { user, branchId } = await requireUserWithBranch();
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const [projects, hours] = await Promise.all([
    prisma.project.findMany({
      where: branchWhere(branchId),
      select: {
        id: true,
        code: true,
        name: true,
        client: { select: { name: true } },
        sites: {
          select: { id: true, name: true, address: true, _count: { select: { employees: true, timesheetEntries: true } } },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.timesheetEntry.groupBy({ by: ["siteId"], where: { ...branchWhere(branchId), month, siteId: { not: null } }, _sum: { totalHours: true } }),
  ]);
  const hoursBySite = new Map(hours.map((h) => [h.siteId, h._sum.totalHours ?? 0]));

  return (
    <SitesBoard
      canWrite={canWrite(subjectOf(user), "projects.sites")}
      monthLabel={now.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
      projects={projects.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        client: p.client?.name ?? null,
        sites: p.sites.map((s) => ({ id: s.id, name: s.name, address: s.address, workers: s._count.employees, hours: hoursBySite.get(s.id) ?? 0, timesheetRows: s._count.timesheetEntries })),
      }))}
    />
  );
}
