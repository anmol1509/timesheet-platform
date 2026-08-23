import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { EmptyState } from "@/components/EmptyState";
import { findDivergences } from "@/lib/attendanceTimesheetSync";
import { SyncReview } from "./sync-review";

/**
 * Where attendance and the client timesheet disagree, and why.
 *
 * Saving attendance already writes the day into the sheet, so in normal use
 * this page is empty. It fills up for the cases the write deliberately will not
 * touch — a sheet already sent to the client, a worker with no supplier to key
 * a row against — and for months whose attendance predates the sync.
 */
export default async function TimesheetSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; clientId?: string; projectId?: string }>;
}) {
  const params = await searchParams;
  const { branchId } = await requireUserWithBranch();

  const today = new Date();
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "")
    ? params.month!
    : `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;

  const [clients, projects] = await Promise.all([
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
  ]);

  const clientId = clients.some((c) => c.id === params.clientId) ? params.clientId : undefined;
  const projectId = projects.some((p) => p.id === params.projectId) ? params.projectId : undefined;

  const divergences = branchId
    ? await findDivergences({ branchId, month, clientId, projectId })
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">
          Attendance vs client timesheet
        </h1>
        <p className="mt-1 text-sm text-muted">
          Days where the roster and the client sheet disagree. Marking attendance
          keeps them in step on its own; what lands here is what it would not
          overwrite.
        </p>
      </div>

      <SyncReview
        month={month}
        clientId={clientId ?? ""}
        projectId={projectId ?? ""}
        clients={clients}
        projects={projects.map((p) => ({
          id: p.id,
          label: `${p.code} — ${p.name}`,
          clientId: p.clientId,
        }))}
        divergences={divergences}
        emptyState={
          <EmptyState
            icon={CheckCircle2}
            title="Everything agrees"
            description="Every day marked this month matches the client timesheet."
          />
        }
      />
    </div>
  );
}
