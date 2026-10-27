import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateOwnerRequest, parseJson } from "@/lib/ownerApiServer";
import { decideCreditRequest, grantBranchCredits, setBranchAllowance } from "@/lib/aiCreditsServer";
import { collectStats } from "@/lib/ownerStats";

/** The owner sets a company's monthly AI allowance and/or adds credits for this month. */
export async function POST(request: Request) {
  const auth = await authenticateOwnerRequest(request, "/api/owner/credits");
  if (auth instanceof NextResponse) return auth;
  const input = parseJson<{ code?: string; setMonthly?: number; grant?: { credits?: number; note?: string }; decide?: { id?: string; decision?: string; note?: string } }>(auth.body);
  if (!input?.code) return NextResponse.json({ error: "Which company?" }, { status: 400 });
  const branch = await prisma.branch.findUnique({ where: { code: input.code.toUpperCase() }, select: { id: true } });
  if (!branch) return NextResponse.json({ error: "No company with that code here." }, { status: 404 });
  if (input.setMonthly !== undefined) {
    if (!Number.isInteger(input.setMonthly) || input.setMonthly < 0 || input.setMonthly > 10_000_000) return NextResponse.json({ error: "Allowance must be a whole number of credits." }, { status: 400 });
    await setBranchAllowance(branch.id, input.setMonthly);
  }
  if (input.grant) {
    const credits = input.grant.credits;
    if (!Number.isInteger(credits) || (credits as number) <= 0 || (credits as number) > 1_000_000) return NextResponse.json({ error: "Credits must be a whole number above zero." }, { status: 400 });
    await grantBranchCredits(branch.id, credits as number, input.grant.note?.slice(0, 200) || null, null);
  }
  if (input.decide) {
    const { id, decision } = input.decide;
    if (!id || (decision !== "APPROVED" && decision !== "DECLINED")) return NextResponse.json({ error: "Which request, and approve or decline?" }, { status: 400 });
    const mine = await prisma.aiCreditRequest.findFirst({ where: { id, branchId: branch.id }, select: { id: true } });
    if (!mine) return NextResponse.json({ error: "That request isn't for this company." }, { status: 404 });
    const r = await decideCreditRequest(id, decision, input.decide.note?.slice(0, 200) || null, null);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 409 });
  }
  return NextResponse.json(await collectStats([branch.id]));
}
