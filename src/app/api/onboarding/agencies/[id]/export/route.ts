import { NextResponse } from "next/server";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { agencyWorkbook, loadAgencies, xlsxResponse } from "@/lib/agencySheet";

/** One agency's candidate sheet. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, branchId } = await requireUserWithBranch();
  if (!can(subjectOf(user), "onboarding.tracker", "export")) return NextResponse.json({ error: "You don't have permission to export onboarding data." }, { status: 403 });
  const [agency] = await loadAgencies(branchId, id);
  if (!agency) return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const slug = agency.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agency";
  return xlsxResponse(await agencyWorkbook(agency), `${slug}-candidates-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
