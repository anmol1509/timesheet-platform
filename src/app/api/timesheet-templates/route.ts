import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";

/** The company's own templates, for the layout picker. */
export async function GET() {
  const { branchId } = await requireUserWithBranch();
  const rows = await prisma.timesheetTemplate.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" }, select: { id: true, name: true, baseKey: true } });
  return NextResponse.json({ templates: rows.map((r) => ({ value: `custom:${r.id}`, name: r.name, baseKey: r.baseKey })) }, { headers: { "Cache-Control": "no-store" } });
}
