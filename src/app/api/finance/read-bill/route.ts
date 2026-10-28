import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { readFileFields } from "@/lib/aiRead";

export const maxDuration = 60;

/** Reads one supplier bill for the bill form. Nothing is stored; the person checks the figures and saves. */
export async function POST(request: Request) {
  const { user, branchId } = await requireUserWithBranch();
  const budget = rateLimit(`billread:${user.id}`, { limit: 200, windowMs: 60 * 60 * 1000 });
  if (!budget.allowed) return NextResponse.json({ error: "A lot of files were read in the last hour. Try again shortly." }, { status: 429, headers: { "Retry-After": String(budget.retryAfter) } });
  const form = await request.formData().catch(() => null);
  const r = await readFileFields("invoice", form?.get("file"), { branchId, userId: user.id, feature: "bill-read" });
  return "fields" in r ? NextResponse.json(r.fields) : NextResponse.json({ error: r.error }, { status: r.status });
}
