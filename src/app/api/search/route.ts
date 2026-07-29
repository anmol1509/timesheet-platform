import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
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

  const [employees, projects, clients, documents] = await Promise.all([
    prisma.employee.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { employeeIdNo: { contains: q, mode: "insensitive" } },
          { trade: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, employeeIdNo: true, trade: true },
      take: RESULT_LIMIT,
    }),
    prisma.project.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, code: true },
      take: RESULT_LIMIT,
    }),
    prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, code: true },
      take: RESULT_LIMIT,
    }),
    prisma.document.findMany({
      where: { filename: { contains: q, mode: "insensitive" } },
      select: { id: true, filename: true, type: true, employeeId: true, employee: { select: { name: true } } },
      take: RESULT_LIMIT,
    }),
  ]);

  return NextResponse.json({ employees, projects, clients, documents });
}
