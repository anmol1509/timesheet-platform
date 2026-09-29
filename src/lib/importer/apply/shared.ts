import { logAudit } from "@/lib/audit";
import type { ApplyCtx } from "../types";

/** Audit entries go to the real database, so a dry run must not write them. */
export function auditor(ctx: ApplyCtx) {
  return (p: Parameters<typeof logAudit>[0]) => (ctx.audit ? logAudit(p) : Promise.resolve());
}

export const rowsLabel = (n: number) => `${n} row${n === 1 ? "" : "s"}`;

/** Names from spreadsheets: trim, collapse spaces. */
export const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export { parseLooseDate } from "@/lib/looseDate";
