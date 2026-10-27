import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateOwnerRequest, parseJson } from "@/lib/ownerApiServer";

/** The owner suspends or reactivates this customer: their own people are locked out, or let back in. */
export async function POST(request: Request) {
  const auth = await authenticateOwnerRequest(request, "/api/owner/suspend");
  if (auth instanceof NextResponse) return auth;
  const input = parseJson<{ suspended?: boolean }>(auth.body);
  if (typeof input?.suspended !== "boolean") return NextResponse.json({ error: "Say whether to suspend." }, { status: 400 });
  const res = await prisma.branch.updateMany({ data: { suspendedAt: input.suspended ? new Date() : null } });
  return NextResponse.json({ ok: true, companies: res.count, suspended: input.suspended });
}
