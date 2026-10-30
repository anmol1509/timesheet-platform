/** Files a profile needs before it counts as complete: a typed number is not proof, so each has to be backed by its own scan. */
const REQUIRED_FILES = ["PASSPORT", "EMIRATES_ID"] as const;

export function isEmployeeComplete(e: {
  passportNumber: string | null;
  emiratesId: string | null;
  nationality: string | null;
  dateOfBirth: Date | null;
  documents: { type: string }[];
}): boolean {
  const fieldsFilled =
    !!e.passportNumber && !!e.emiratesId && !!e.nationality && !!e.dateOfBirth;
  const hasFiles = REQUIRED_FILES.every((t) => e.documents.some((d) => d.type === t));
  return fieldsFilled && hasFiles;
}
