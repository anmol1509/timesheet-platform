import { buildChecklist, type ChecklistFile, type DocTypeDef } from "@/lib/documentTypes";

export type CandidateDocStatus = {
  /** Required types with a current (not expired) file. */
  have: number;
  required: number;
  /** Labels of required types that are missing or whose file has expired. */
  missing: string[];
};

/** How a candidate stands on the documents the branch requires: missing and expired both count as not handed over. */
export function candidateDocStatus(types: DocTypeDef[], files: ChecklistFile[], now: number = Date.now()): CandidateDocStatus {
  const required = buildChecklist(types, files, false, now).filter((i) => i.required);
  const lacking = required.filter((i) => i.state === "missing" || i.state === "expired");
  return { have: required.length - lacking.length, required: required.length, missing: lacking.map((i) => i.type.label) };
}
