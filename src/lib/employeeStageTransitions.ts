import { prisma } from "@/lib/db";

/**
 * The writes that move a worker between stages.
 *
 * Kept apart from the stage vocabulary in `employeeStage.ts` so client
 * components can name a stage without pulling the database client into the
 * browser bundle. Every stage change in the app goes through one of these, so
 * the rules about what may follow what live in exactly one place.
 */

/**
 * Marks workers as mobilised to a site from a given date.
 *
 * Deliberately does not touch ON_VACATION or TERMINATED: those are decisions
 * about the person, and being allocated on paper shouldn't quietly override
 * them.
 *
 * An ON_SITE worker moved to a new demand goes back to awaiting arrival, and
 * the old arrival date is cleared — it belonged to the previous site.
 */
export async function markUnderMobilisation(
  employeeIds: string[],
  mobilisationDate: Date | null
) {
  if (employeeIds.length === 0) return 0;
  const result = await prisma.employee.updateMany({
    where: {
      id: { in: employeeIds },
      status: { in: ["IDLE", "UNDER_MOBILISATION", "ON_SITE"] },
    },
    data: { status: "UNDER_MOBILISATION", mobilisationDate, siteArrivalDate: null },
  });
  return result.count;
}

/**
 * Confirms that mobilised workers actually reached site.
 *
 * A separate act from allocating them, because it is a separate fact: the
 * allocation is made in the office days ahead, the arrival is reported from
 * site on the day. Setting the site is optional — the demand names a project,
 * not always which of its sites the worker ended up on.
 *
 * Only UNDER_MOBILISATION rows move. Someone already ACTIVE has better evidence
 * of being on site than this confirmation would add.
 */
export async function markOnSite(
  employeeIds: string[],
  siteArrivalDate: Date,
  siteId?: string | null
) {
  if (employeeIds.length === 0) return 0;
  const result = await prisma.employee.updateMany({
    where: { id: { in: employeeIds }, status: "UNDER_MOBILISATION" },
    data: {
      status: "ON_SITE",
      siteArrivalDate,
      ...(siteId ? { siteId } : {}),
    },
  });
  return result.count;
}

/**
 * Undoes a site-arrival confirmation, back to awaiting arrival.
 *
 * Arrival is reported by hand and gets reported wrong; without this the only
 * fix would be editing the worker's profile, which wouldn't clear the date.
 */
export async function revertSiteArrival(employeeIds: string[]) {
  if (employeeIds.length === 0) return 0;
  const result = await prisma.employee.updateMany({
    where: { id: { in: employeeIds }, status: "ON_SITE" },
    data: { status: "UNDER_MOBILISATION", siteArrivalDate: null },
  });
  return result.count;
}

/**
 * Promotes a worker to ACTIVE the first time attendance is marked for them.
 *
 * Called after attendance is saved rather than on a schedule, so the stage
 * reflects what actually happened on site instead of what was planned.
 *
 * Accepts UNDER_MOBILISATION as well as ON_SITE: attendance is stronger
 * evidence of arrival than the confirmation step, so a worker nobody got round
 * to confirming shouldn't be held back by it.
 *
 * That same reasoning fills in the arrival date when it is still blank. Marking
 * a man present says he was on site that day, so asking a second person to go
 * and confirm the arrival afterwards is asking for the same fact twice — and
 * leaving it blank would lose how late the mobilisation actually ran. Only ever
 * filled, never corrected: a date somebody entered by hand outranks this.
 */
export async function markActiveFromAttendance(
  employeeIds: string[],
  attendanceDate?: Date
) {
  if (employeeIds.length === 0) return 0;

  if (attendanceDate) {
    await prisma.employee.updateMany({
      where: {
        id: { in: employeeIds },
        status: { in: ["UNDER_MOBILISATION", "ON_SITE"] },
        siteArrivalDate: null,
      },
      data: { siteArrivalDate: attendanceDate },
    });
  }

  const result = await prisma.employee.updateMany({
    where: { id: { in: employeeIds }, status: { in: ["UNDER_MOBILISATION", "ON_SITE"] } },
    data: { status: "ACTIVE" },
  });
  return result.count;
}

/**
 * Puts a worker back on the bench when they stop being on a job.
 *
 * The stage, the mobilisation date and the arrival date all describe one
 * placement, so they end together. Without this they outlive it: a worker
 * pulled off a demand kept showing up on the arrival queue as ever more
 * overdue, and the only way out was editing the profile by hand.
 *
 * ON_VACATION and TERMINATED are left alone, for the same reason mobilising
 * doesn't overwrite them — those are decisions about the person, not the job.
 */
export async function releaseFromMobilisation(employeeIds: string[]) {
  if (employeeIds.length === 0) return 0;
  const result = await prisma.employee.updateMany({
    where: {
      id: { in: employeeIds },
      status: { in: ["UNDER_MOBILISATION", "ON_SITE", "ACTIVE"] },
    },
    data: { status: "IDLE", mobilisationDate: null, siteArrivalDate: null },
  });
  return result.count;
}
