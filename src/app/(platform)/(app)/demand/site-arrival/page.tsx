import { PageHeader } from "@/components/PageHeader";
import { MapPinCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { EmptyState } from "@/components/EmptyState";
import { SiteArrivalBoard } from "./site-arrival-board";

export const metadata = { title: "Site arrival" };

/**
 * Who has been mobilised on paper but not yet confirmed on site.
 *
 * Kept as its own screen rather than a column on the mobilisation queue,
 * because it is a different job done by different people: mobilisation is
 * office work done ahead of time, this is reported back from site on the day.
 */
export default async function SiteArrivalPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { branchId } = await requireUserWithBranch();
  const sp = await searchParams;

  const [pending, arrived, unrecorded, sites] = await Promise.all([
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
    prisma.employee.findMany({
      // Active workers who never had an arrival date (loaded in as Active, or moved there without one).
      // Attendance refuses them until mobilisation records when they reached site.
      where: { ...branchWhere(branchId), active: true, status: "ACTIVE", siteArrivalDate: null },
      select: {
        id: true,
        name: true,
        employeeIdNo: true,
        trade: true,
        mobilisationDate: true,
        joinDate: true,
        projectId: true,
        project: { select: { name: true, code: true, client: { select: { name: true } } } },
      },
      orderBy: [{ joinDate: "asc" }, { name: "asc" }],
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
    joinDate?: Date | null;
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
    projectLabel: e.project ? `${e.project.code}: ${e.project.name}` : null,
    mobilisationDate: e.mobilisationDate ? e.mobilisationDate.toISOString().slice(0, 10) : null,
    joinDate: e.joinDate ? e.joinDate.toISOString().slice(0, 10) : null,
    siteArrivalDate: e.siteArrivalDate ? e.siteArrivalDate.toISOString().slice(0, 10) : null,
    siteName: e.site?.name ?? null,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Site arrival"
        icon={MapPinCheck}
        description={<>Confirm who actually reached site. Mobilising commits a worker; this records that they turned up. Workers who are Active but have no arrival date are listed too, because attendance cannot be marked for them until it is recorded.</>}
      />

      {pending.length === 0 && arrived.length === 0 && unrecorded.length === 0 ? (
        <EmptyState
          icon={MapPinCheck}
          title="Nobody is awaiting arrival"
          description="Workers appear here once they are mobilised against a demand."
        />
      ) : (
        <SiteArrivalBoard
          pending={pending.map(toRow)}
          arrived={arrived.map(toRow)}
          unrecorded={unrecorded.map(toRow)}
          initialTab={sp.tab === "unrecorded" || (pending.length === 0 && unrecorded.length > 0 && sp.tab !== "arrived") ? "unrecorded" : sp.tab === "arrived" ? "arrived" : "pending"}
          sites={sites}
        />
      )}
    </div>
  );
}
