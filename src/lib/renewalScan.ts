export type ScanVerdict =
  | { kind: "none" }
  | { kind: "undated"; id: string }
  | { kind: "agrees"; id: string }
  | { kind: "differs"; id: string; scanExpiry: string };

/** How the file behind a renewal compares with the date on the record. Dates are compared as calendar days. */
export function scanVerdict(recordExpiry: string, scan: { id: string; expiry: string | null } | null): ScanVerdict {
  if (!scan) return { kind: "none" };
  if (!scan.expiry) return { kind: "undated", id: scan.id };
  return scan.expiry.slice(0, 10) === recordExpiry.slice(0, 10) ? { kind: "agrees", id: scan.id } : { kind: "differs", id: scan.id, scanExpiry: scan.expiry };
}
