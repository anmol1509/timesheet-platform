import { ENTITY_META } from "@/lib/auditPresentation";

/** What the audit log page and the export both understand, taken from the address so a filtered view can be shared. */
export type AuditQuery = {
  q?: string;
  user?: string; // user id
  module?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string; // YYYY-MM-DD, UAE day
  to?: string;
  source?: string;
  batch?: string;
};

const KEYS = ["q", "user", "module", "action", "entityType", "entityId", "from", "to", "source", "batch"] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseAuditQuery(sp: URLSearchParams | Record<string, string | string[] | undefined>): AuditQuery {
  const get = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim().slice(0, 120) : undefined;
  };
  const out: AuditQuery = {};
  for (const k of KEYS) { const v = get(k); if (v) out[k] = v; }
  if (out.from && !DAY.test(out.from)) delete out.from;
  if (out.to && !DAY.test(out.to)) delete out.to;
  return out;
}

export const auditQueryString = (q: AuditQuery, extra: Record<string, string | undefined> = {}) => {
  const p = new URLSearchParams();
  for (const k of KEYS) if (q[k]) p.set(k, q[k]!);
  for (const [k, v] of Object.entries(extra)) { if (v) p.set(k, v); else p.delete(k); }
  return p.toString();
};

/** A line saying which filters are on, for the top of an export. */
export function describeAuditQuery(q: AuditQuery, names: { user?: string }): string[] {
  const out: string[] = [];
  if (q.from || q.to) out.push(`Dates: ${q.from ?? "the start"} to ${q.to ?? "today"} (UAE days)`);
  if (q.user) out.push(`Person: ${names.user ?? q.user}`);
  if (q.module) out.push(`Area: ${q.module}`);
  if (q.entityType) out.push(`Record type: ${ENTITY_META[q.entityType]?.label ?? q.entityType}`);
  if (q.entityId) out.push("One record only");
  if (q.action) out.push(`Action: ${({ CREATE: "Added", UPDATE: "Changed", DELETE: "Deleted", VIEW: "Opened" } as Record<string, string>)[q.action] ?? q.action}`);
  if (q.source) out.push(`Source: ${q.source}`);
  if (q.q) out.push(`Search: "${q.q}"`);
  return out;
}
