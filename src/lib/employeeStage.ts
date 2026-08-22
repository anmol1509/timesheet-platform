import { prisma } from "@/lib/db";

/**
 * A worker's three working stages, and the events that move between them.
 *
 * IDLE               on the books, not working
 * UNDER_MOBILISATION assigned to a site, not yet started
 * ACTIVE             attendance has been marked since mobilising
 *
 * The middle stage is the one that matters operationally: a worker who has been
 * committed to a client but hasn't turned up is neither idle nor working, and
 * counting them as either hides the gap. ON_VACATION and TERMINATED sit outside
 * this cycle and are set by hand.
 */
export const WORKING_STAGES = ["IDLE", "UNDER_MOBILISATION", "ACTIVE"] as const;

export const STAGE_LABEL: Record<string, string> = {
  IDLE: "Idle",
  UNDER_MOBILISATION: "Under mobilisation",
  ACTIVE: "Active",
  ON_VACATION: "On vacation",
  TERMINATED: "Terminated",
};

export const STAGE_COLOR: Record<string, "green" | "amber" | "slate" | "red"> = {
  IDLE: "slate",
  UNDER_MOBILISATION: "amber",
  ACTIVE: "green",
  ON_VACATION: "slate",
  TERMINATED: "red",
};

/**
 * Marks workers as mobilised to a site from a given date.
 *
 * Deliberately does not touch ON_VACATION or TERMINATED: those are decisions
 * about the person, and being allocated on paper shouldn't quietly override
 * them.
 */
export async function markUnderMobilisation(
  employeeIds: string[],
  mobilisationDate: Date | null
) {
  if (employeeIds.length === 0) return 0;
  const result = await prisma.employee.updateMany({
    where: { id: { in: employeeIds }, status: { in: ["IDLE", "UNDER_MOBILISATION"] } },
    data: { status: "UNDER_MOBILISATION", mobilisationDate },
  });
  return result.count;
}

/**
 * Promotes a worker to ACTIVE the first time attendance is marked for them.
 *
 * Called after attendance is saved rather than on a schedule, so the stage
 * reflects what actually happened on site instead of what was planned.
 */
export async function markActiveFromAttendance(employeeIds: string[]) {
  if (employeeIds.length === 0) return 0;
  const result = await prisma.employee.updateMany({
    where: { id: { in: employeeIds }, status: "UNDER_MOBILISATION" },
    data: { status: "ACTIVE" },
  });
  return result.count;
}
