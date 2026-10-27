/**
 * "Other documents" (the catch-all on an employee, a company, a client, a project): the name typed or read from the file
 * is what the document is called everywhere, and a document is tracked for expiry exactly when it has an expiry date.
 * So there is no extra column: ticking "Track expiry" asks for a date, and unticking it files the document without one,
 * which keeps it out of renewals and reminders.
 */

const EXT = /\.[A-Za-z0-9]{1,5}$/;

/** The name to store: what was typed, keeping the file's own extension so it still opens correctly; the file's name when nothing was typed. */
export function otherDocFilename(typed: string, original: string): string {
  const name = typed.trim().replace(/\s+/g, " ").slice(0, 100);
  if (!name) return original;
  const ext = EXT.exec(original)?.[0] ?? "";
  return ext && !name.toLowerCase().endsWith(ext.toLowerCase()) ? name + ext : name;
}

/** The expiry to store: the date when it is tracked, nothing when it isn't (or when it is ticked but no date is given). */
export function trackedExpiry(track: boolean, expiry: string | null | undefined): string {
  return track && expiry && /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? expiry : "";
}

/** The problem with a name and expiry pair, or null when it is fine. Ticking Track expiry means a date is needed. */
export function otherDocProblem(name: string, track: boolean, expiry: string): string | null {
  if (!name.trim()) return "Give the document a name.";
  if (track && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return "Add the expiry date, or untick Track expiry.";
  return null;
}

/** A readable default name from a file name: no extension, separators turned to spaces. */
export function nameFromFile(fileName: string): string {
  return fileName.replace(EXT, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}
