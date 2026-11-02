/** The steps an absconding case goes through. Reported and Under investigation keep the worker marked as absconding; the other two end it. */
export const ABSCOND_CASE_STATUSES = ["Reported", "Under investigation", "Closed", "Returned"] as const;
export type AbscondCaseStatus = (typeof ABSCOND_CASE_STATUSES)[number];
