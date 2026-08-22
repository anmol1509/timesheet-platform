import { MapPinCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { EmptyState } from "@/components/EmptyState";
import { SiteArrivalBoard } from "./site-arrival-board";

/**
 * Who has been mobilised on paper but not yet confirmed on site.
 *
 * Kept as its own screen rather than a column on the mobilisation queue,
 * because it is a different job done by different people: mobilisation is
 * office work done ahead of time, this is reported back from site on the day.
 */
export default async function SiteArrivalPage() {
  const { branchId } = await requireUserWithBranch();

  const [pending, arrived, sites] = await Promise.all([
    prisma.employee.findMany({
      // Deactivated workers are off the roster entirely; `active` and `status` are
      // deliberately independent here, so the queue has to say so itself.
      where: { ...branchWhere(branchId), active: true, status: "UNDER_MOBILISATION" },
      select: {
        id: true,
        name: true,
        employeeIdNo: true,
        trade: true,
        mobilisationDate: true,
        projectId: true,
        project: { select: { name: true, code: true, client: { select: { name: true } } } },
      },
      // Longest-waiting first: those are the mobilisations that have gone wrong.
      orderBy: [{ mobilisationDate: "asc" }, { name: "asc" }],
    }),
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), active: true, status: "ON_SITE" },
      select: {
        id: true,
        name: true,
        employeeIdNo: true,
        trade: true,
        mobilisationDate: true,
        siteArrivalDate: true,
        projectId: true,
        site: { select: { name: true } },
        project: { select: { name: true, code: true, client: { select: { name: true } } } },
      },
      orderBy: [{ siteArrivalDate: "desc" }, { name: "asc" }],
    }),
    prisma.site.findMany({
      where: { project: branchWhere(branchId) },
      select: { id: true, name: true, projectId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const toRow = (e: {
    id: string;
    name: string;
    employeeIdNo: string;
    trade: string | null;
    projectId: string | null;
    mobilisationDate: Date | null;
    siteArrivalDate?: Date | null;
    site?: { name: string } | null;
    project: { name: string; code: string; client: { name: string } } | null;
  }) => ({
    id: e.id,
    name: e.name,
    employeeIdNo: e.employeeIdNo,
    trade: e.trade,
    projectId: e.projectId,
    clientName: e.project?.client.name ?? null,
    projectLabel: e.project ? `${e.project.code} — ${e.project.name}` : null,
    mobilisationDate: e.mobilisationDate ? e.mobilisationDate.toISOString().slice(0, 10) : null,
    siteArrivalDate: e.siteArrivalDate ? e.siteArrivalDate.toISOString().slice(0, 10) : null,
    siteName: e.site?.name ?? null,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Site arrival</h1>
        <p className="mt-1 text-sm text-muted">
          Confirm who actually reached site. Mobilising commits a worker; this
          records that they turned up.
        </p>
      </div>

      {pending.length === 0 && arrived.length === 0 ? (
        <EmptyState
          icon={MapPinCheck}
          title="Nobody is awaiting arrival"
          description="Workers appear here once they are mobilised against a demand."
        />
      ) : (
        <SiteArrivalBoard
          pending={pending.map(toRow)}
          arrived={arrived.map(toRow)}
          sites={sites}
        />
      )}
    </div>
  );
}
