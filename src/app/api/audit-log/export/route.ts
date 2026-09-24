import { NextResponse } from "next/server";
import { getCurrentUser, resolveSuperAdminBranchId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { toCsv } from "@/lib/csvExport";

const MAX_ROWS = 50_000;

// Admin-only CSV export of the audit trail, for auditors and clients.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role === "STAFF") return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const isSuper = user.role === "SUPER_ADMIN";
  const branchId = isSuper ? await resolveSuperAdminBranchId() : user.branchId;

  const q = new URL(request.url).searchParams;
  const from = q.get("from") ? new Date(`${q.get("from")}T00:00:00.000Z`) : null;
  const to = q.get("to") ? new Date(`${q.get("to")}T23:59:59.999Z`) : null;
  if ((from && isNaN(from.getTime())) || (to && isNaN(to.getTime()))) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }
  const entity = q.get("entity")?.trim();
  const action = q.get("action")?.trim();

  const rows = await prisma.auditLog.findMany({
    where: {
      ...branchWhere(branchId),
      ...(entity ? { entityType: entity } : {}),
      ...(action ? { action } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  const csv = toCsv(
    ["When (UTC)", "Entity", "Entity ID", "Action", "By", "Changes"],
    rows.map((r) => [r.createdAt.toISOString(), r.entityType, r.entityId, r.action, r.userName, r.changes])
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
