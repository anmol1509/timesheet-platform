import { NextResponse } from "next/server";
import { getCurrentUser, resolveSuperAdminBranchId, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";

const RESULT_LIMIT = 5;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json({ employees: [], projects: [], clients: [], suppliers: [], documents: [] });
  }

  // Same branch scoping every list page applies — a super admin viewing
  // "all branches" (null) searches everything.
  const branchId = user.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId() : user.branchId;
  const scope = branchWhere(branchId);

  // Results only from modules this user may open, so search can't leak
  // records their role hides from the sidebar.
  const subject = subjectOf(user);
  const canWorkforce = can(subject, "workforce", "view");
  const canProjects = can(subject, "projects", "view");
  const canPartners = can(subject, "partners", "view");

  const [employees, projects, clients, suppliers, documents] = await Promise.all([
    canWorkforce ? prisma.employee.findMany({
      where: {
        ...scope,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { employeeIdNo: { contains: q, mode: "insensitive" } },
          { trade: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, employeeIdNo: true, trade: true, photoMimeType: true, status: true },
      take: RESULT_LIMIT,
    }) : Promise.resolve([]),
    canProjects ? prisma.project.findMany({
      where: {
        ...scope,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, code: true, client: { select: { name: true } } },
      take: RESULT_LIMIT,
    }) : Promise.resolve([]),
    canPartners ? prisma.client.findMany({
      where: {
        ...scope,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, code: true },
      take: RESULT_LIMIT,
    }) : Promise.resolve([]),
    canPartners ? prisma.supplier.findMany({
      where: {
        ...scope,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, code: true, isOwnCompany: true },
      take: RESULT_LIMIT,
    }) : Promise.resolve([]),
    canWorkforce ? prisma.document.findMany({
      where: { filename: { contains: q, mode: "insensitive" }, employee: scope },
      select: { id: true, filename: true, type: true, employeeId: true, employee: { select: { name: true } } },
      take: RESULT_LIMIT,
    }) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    employees: employees.map(({ photoMimeType, ...e }) => ({ ...e, hasPhoto: !!photoMimeType })),
    projects,
    clients,
    suppliers,
    documents,
  });
}
