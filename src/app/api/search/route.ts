import { NextResponse } from "next/server";
import { getCurrentUser, subjectOf } from "@/lib/auth";
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
    return NextResponse.json({ employees: [], projects: [], clients: [], documents: [] });
  }

  // Results only from modules this user may open, so search can't leak
  // records their role hides from the sidebar.
  const subject = subjectOf(user);
  const canWorkforce = can(subject, "workforce", "view");
  const canProjects = can(subject, "projects", "view");
  const canPartners = can(subject, "partners", "view");

  const [employees, projects, clients, documents] = await Promise.all([
    canWorkforce ? prisma.employee.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { employeeIdNo: { contains: q, mode: "insensitive" } },
          { trade: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, employeeIdNo: true, trade: true },
      take: RESULT_LIMIT,
    }) : Promise.resolve([]),
    canProjects ? prisma.project.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, code: true },
      take: RESULT_LIMIT,
    }) : Promise.resolve([]),
    canPartners ? prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, code: true },
      take: RESULT_LIMIT,
    }) : Promise.resolve([]),
    canWorkforce ? prisma.document.findMany({
      where: { filename: { contains: q, mode: "insensitive" } },
      select: { id: true, filename: true, type: true, employeeId: true, employee: { select: { name: true } } },
      take: RESULT_LIMIT,
    }) : Promise.resolve([]),
  ]);

  return NextResponse.json({ employees, projects, clients, documents });
}
