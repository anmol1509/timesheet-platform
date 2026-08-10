const COMPLETING_DOC_TYPES = new Set(["PASSPORT", "VISA", "EMIRATES_ID"]);

export function isEmployeeComplete(e: {
  passportNumber: string | null;
  emiratesId: string | null;
  nationality: string | null;
  dateOfBirth: Date | null;
  documents: { type: string }[];
}): boolean {
  const fieldsFilled =
    !!e.passportNumber && !!e.emiratesId && !!e.nationality && !!e.dateOfBirth;
  const hasDoc = e.documents.some((d) => COMPLETING_DOC_TYPES.has(d.type));
  return fieldsFilled && hasDoc;
}
