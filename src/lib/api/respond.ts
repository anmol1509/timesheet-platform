import { randomBytes } from "crypto";

export const newRequestId = () => "req_" + randomBytes(6).toString("hex");

/** One error shape everywhere, so an integration can handle failures without parsing prose. */
export function apiError(status: number, code: string, message: string, requestId: string, headers: Record<string, string> = {}) {
  return Response.json({ error: { code, message, request_id: requestId } }, { status, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store", ...headers } });
}

export function apiOk(body: unknown, requestId: string, headers: Record<string, string> = {}) {
  return Response.json(body, { headers: { "X-Request-Id": requestId, "Cache-Control": "no-store", ...headers } });
}

export const MAX_PAGE = 200;
export const DEFAULT_PAGE = 50;

/** limit + cursor from the query string, as Prisma arguments; one extra row is fetched to know if there is a next page. */
export function pageArgs(q: URLSearchParams) {
  const raw = Number(q.get("limit"));
  const limit = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), MAX_PAGE) : DEFAULT_PAGE;
  const cursor = q.get("cursor");
  return {
    limit,
    args: { take: limit + 1, orderBy: { id: "asc" as const }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) },
  };
}

export function finishPage<T extends { id: string }>(rows: T[], limit: number) {
  const more = rows.length > limit;
  const data = more ? rows.slice(0, limit) : rows;
  return { data, next_cursor: more ? data[data.length - 1].id : null };
}

/** YYYY-MM-DD for date-only fields, ISO time for timestamps, null when empty. */
export const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
export const stamp = (d: Date | null | undefined) => (d ? d.toISOString() : null);
export const money = (d: { toString(): string } | number | null | undefined) => (d == null ? null : Math.round(Number(d.toString()) * 100) / 100);

/** A date query parameter, or null when absent; undefined when present but not a valid date. */
export function dateParam(q: URLSearchParams, name: string): Date | null | undefined {
  const v = q.get(name);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
