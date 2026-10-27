import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FEATURE_LABEL, monthKey, monthRange } from "@/lib/aiCredits";
import { aiBranchOf } from "@/lib/aiCreditsServer";

/** What the header's credits panel shows beside the totals: the three things that used the most credits this month. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const branchId = await aiBranchOf(user);
  if (!branchId) return NextResponse.json({ top: [] });
  const { start, end } = monthRange(monthKey(new Date()));
  const rows = await prisma.aiUsage.groupBy({ by: ["feature"], where: { branchId, createdAt: { gte: start, lt: end } }, _sum: { credits: true }, orderBy: { _sum: { credits: "desc" } }, take: 3 });
  return NextResponse.json({ top: rows.map((r) => ({ label: FEATURE_LABEL[r.feature] ?? r.feature, credits: Math.round(r._sum.credits ?? 0) })) });
}
