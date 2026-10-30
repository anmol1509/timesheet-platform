/**
 * Turning a database row into plain JSON and back, so a deleted record can be kept as a snapshot and put back exactly:
 * files become base64 text, dates become ISO text, and the column types say how to turn each one back. No database
 * in here, so it is tested on its own.
 */

export type ColumnInfo = { kind: string; type: string };

const isBytes = (v: unknown): v is Uint8Array => v instanceof Uint8Array;

export function serialiseRow(row: Record<string, unknown>, columns: Record<string, ColumnInfo>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const col = columns[key];
    if (!col || col.kind === "object") continue; // relations are not part of the row
    if (value === null || value === undefined) out[key] = null;
    else if (isBytes(value)) out[key] = { $b64: Buffer.from(value).toString("base64") };
    else if (value instanceof Date) out[key] = value.toISOString();
    else if (typeof value === "bigint") out[key] = value.toString();
    else if (col.type === "Decimal") out[key] = String(value);
    else out[key] = value;
  }
  return out;
}

export function reviveRow(json: Record<string, unknown>, columns: Record<string, ColumnInfo>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(json)) {
    const col = columns[key];
    if (!col || col.kind === "object") continue;
    if (value === null || value === undefined) { out[key] = null; continue; }
    switch (col.type) {
      case "DateTime": out[key] = new Date(String(value)); break;
      case "Bytes": out[key] = value && typeof value === "object" && "$b64" in (value as object) ? Buffer.from(String((value as { $b64: string }).$b64), "base64") : null; break;
      case "BigInt": out[key] = BigInt(String(value)); break;
      case "Decimal": out[key] = String(value); break;
      default: out[key] = value;
    }
  }
  return out;
}

/** Roughly how many bytes the snapshot takes, so a huge delete can be refused instead of filling the database. */
export const snapshotSize = (snapshot: unknown) => JSON.stringify(snapshot).length;
