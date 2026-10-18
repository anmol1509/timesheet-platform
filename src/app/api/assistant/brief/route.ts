import { NextResponse } from "next/server";
import { getCurrentUser, isBlockedByPermissions, resolveSuperAdminBranchId, subjectOf } from "@/lib/auth";
import { loadBriefFacts } from "@/lib/assistantBriefData";
import { buildBrief } from "@/lib/assistantBrief";

/** What needs attention today, for the assistant's opening screen. Read-only, scoped like the tools. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await isBlockedByPermissions(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const branchId = user.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId() : user.branchId;
    const items = buildBrief(await loadBriefFacts({ subject: subjectOf(user), branchId }));
    return NextResponse.json({ items });
  } catch (err) {
    console.error("assistant brief failed", err);
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}
