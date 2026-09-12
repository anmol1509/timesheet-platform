import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import type { BadgeColor } from "@/components/Badge";

export type PipelineStage = {
  status: string;
  label: string;
  /** What the stage means operationally, shown as the row's secondary line. */
  hint: string;
  color: BadgeColor;
  count: number;
};

export type TimesheetPipeline = {
  /** Month the counts cover, "2026-09". Null when no timesheets exist at all. */
  month: string | null;
  stages: PipelineStage[];
  /** Rejected sits outside the pipeline — it's rework, not a step forward. */
  rejected: number;
  total: number;
};

// Mirrors the DRAFT → SUBMITTED → UNDER_REVIEW → CLIENT_APPROVED → LOCKED walk
// enforced by TIMESHEET_TRANSITIONS on the client-timesheet grid.
const STAGES: Omit<PipelineStage, "count">[] = [
  { status: "DRAFT", label: "Draft", hint: "Not yet submitted", color: "slate" },
  { status: "SUBMITTED", label: "Submitted", hint: "Awaiting internal review", color: "blue" },
  { status: "UNDER_REVIEW", label: "Under review", hint: "With the reviewer", color: "amber" },
  { status: "CLIENT_APPROVED", label: "Client approved", hint: "Ready to invoice", color: "green" },
  { status: "LOCKED", label: "Locked", hint: "Invoiced and frozen", color: "slate" },
];

/** Where this month's timesheet rows sit in the approval pipeline. */
export async function getTimesheetPipeline(
  branchId: string | null = null
): Promise<TimesheetPipeline> {
  const where = branchWhere(branchId);

  const latest = await prisma.timesheetEntry.findFirst({
    where,
    orderBy: { month: "desc" },
    select: { month: true },
  });
  if (!latest) {
    return { month: null, stages: STAGES.map((s) => ({ ...s, count: 0 })), rejected: 0, total: 0 };
  }

  const grouped = await prisma.timesheetEntry.groupBy({
    by: ["status"],
    where: { ...where, month: latest.month },
    _count: { _all: true },
  });

  const counts = new Map(grouped.map((g) => [g.status, g._count._all]));

  return {
    month: latest.month,
    stages: STAGES.map((s) => ({ ...s, count: counts.get(s.status) ?? 0 })),
    rejected: counts.get("REJECTED") ?? 0,
    total: grouped.reduce((sum, g) => sum + g._count._all, 0),
  };
}
