const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The expiry is the later of the dates a document prints: when the model reports an issue date at or after the expiry, the two were swapped. */
export function pickExpiry(read: { expiry?: string; issue?: string }): string | null {
  const expiry = read.expiry && ISO.test(read.expiry) ? read.expiry : null;
  const issue = read.issue && ISO.test(read.issue) ? read.issue : null;
  if (expiry && issue) return expiry >= issue ? expiry : issue;
  return expiry;
}
