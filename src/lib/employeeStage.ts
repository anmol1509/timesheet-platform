/**
 * A worker's four working stages, and the events that move between them.
 *
 * IDLE               on the books, not working
 * UNDER_MOBILISATION allocated to a demand on paper, not yet turned up
 * ON_SITE            someone confirmed they physically reached site
 * ACTIVE             attendance has been marked since mobilising
 *
 * The two middle stages are the ones that matter operationally. Allocation is a
 * plan and attendance is paperwork that lands days later; between them sits the
 * only question the client actually asks — did the man reach site. Nothing
 * recorded that, so a mobilisation that quietly failed looked identical to one
 * that worked until the timesheet came up short at month end.
 *
 * ON_VACATION and TERMINATED sit outside this cycle and are set by hand.
 */
export const WORKING_STAGES = ["IDLE", "UNDER_MOBILISATION", "ON_SITE", "ACTIVE"] as const;

/**
 * The stages that mean "on a job" — everyone a site is expecting to see.
 *
 * Screens that ask "who is working" must use this rather than testing for
 * ACTIVE. Attendance did test for ACTIVE, which hid every newly mobilised
 * worker from the very screen whose job is to record that they turned up —
 * and since attendance is what promotes them, they could never become ACTIVE
 * either.
 */
export const ON_WORK_STAGES = ["UNDER_MOBILISATION", "ON_SITE", "ACTIVE"] as const;

export function isOnWork(status: string) {
  return (ON_WORK_STAGES as readonly string[]).includes(status);
}

export const STAGE_LABEL: Record<string, string> = {
  IDLE: "Idle",
  UNDER_MOBILISATION: "Under mobilisation",
  ON_SITE: "On site",
  ACTIVE: "Active",
  ON_VACATION: "On vacation",
  TERMINATED: "Terminated",
};

export const STAGE_COLOR: Record<string, "green" | "amber" | "slate" | "red" | "blue"> = {
  IDLE: "slate",
  UNDER_MOBILISATION: "amber",
  ON_SITE: "blue",
  ACTIVE: "green",
  ON_VACATION: "slate",
  TERMINATED: "red",
};
