import { authenticateApiRequest, hasScope } from "@/lib/api/auth";
import { apiError, apiOk, newRequestId } from "@/lib/api/respond";
import { resolveRoute } from "@/lib/api/resources";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The public API: read-only in this version. Every request is authenticated by
 * an API key (never the browser session), limited to that key's branch and
 * scopes, and answered in one JSON shape.
 */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const requestId = newRequestId();
  const auth = await authenticateApiRequest(request, requestId);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const segments = (await params).path.filter(Boolean);
  const url = new URL(request.url);

  // Who am I: lets an integration confirm its key works and see what it may do.
  if (segments.length === 1 && segments[0] === "me") {
    const branch = await prisma.branch.findUnique({ where: { id: ctx.branchId }, select: { id: true, code: true, name: true } });
    return apiOk({ data: { branch, scopes: ctx.scopes } }, requestId, ctx.rateHeaders);
  }

  const found = resolveRoute(segments);
  if (!found) return apiError(404, "not_found", "No such endpoint.", requestId, ctx.rateHeaders);
  if (!hasScope(ctx, found.route.scope)) {
    return apiError(403, "missing_scope", `This key does not have the '${found.route.scope}' permission.`, requestId, ctx.rateHeaders);
  }

  try {
    const result = await found.route.run(ctx, url.searchParams, found.id, found.sub);
    if (result.status === 200) return apiOk(result.body, requestId, ctx.rateHeaders);
    return apiError(result.status, result.code, result.message, requestId, ctx.rateHeaders);
  } catch (e) {
    console.error(`[api] ${requestId} failed:`, e);
    return apiError(500, "server_error", "Something went wrong on our side. Quote the request ID if you contact support.", requestId, ctx.rateHeaders);
  }
}

const readOnly = async () =>
  apiError(405, "method_not_allowed", "This version of the API is read-only. Use GET.", newRequestId(), { Allow: "GET" });
export { readOnly as POST, readOnly as PUT, readOnly as PATCH, readOnly as DELETE };
