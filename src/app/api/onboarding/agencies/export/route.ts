import { NextResponse } from "next/server";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { loadAgencies, masterWorkbook, xlsxResponse } from "@/lib/agencySheet";

/** The master sheet: every recruitment agency with its numbers, and every candidate. */
export async function GET() {
  const { user, branchId } = await requireUserWithBranch();
  if (!can(subjectOf(user), "onboarding.tracker", "export")) return NextResponse.json({ error: "You don't have permission to export onboarding data." }, { status: 403 });
  const agencies = await loadAgencies(branchId);
  return xlsxResponse(await masterWorkbook(agencies), `agencies-master-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
