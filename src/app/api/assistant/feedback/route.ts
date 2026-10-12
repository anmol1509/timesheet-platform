import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isBlockedByPermissions, resolveSuperAdminBranchId } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

/** A thumbs up or down on one of My Assistant's answers, kept so the answers it gives can be improved. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await isBlockedByPermissions(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const limit = rateLimit(`assistant-feedback:${user.id}`, { limit: 60, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ error: "Too many ratings, try again later." }, { status: 429 });

  let body: { question?: unknown; answer?: unknown; rating?: unknown; page?: unknown; comment?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const question = text(body.question, 600);
  const answer = text(body.answer, 2500);
  const rating = body.rating === "UP" || body.rating === "DOWN" ? body.rating : null;
  if (!question || !answer || !rating) return NextResponse.json({ error: "Missing rating" }, { status: 400 });
  const page = text(body.page, 120);
  const branchId = user.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId() : user.branchId;
  await prisma.assistantFeedback.create({
    data: { userId: user.id, userName: user.name, branchId, page: page.startsWith("/") ? page.split("?")[0] : null, question, answer, rating, comment: text(body.comment, 500) || null },
  });
  return NextResponse.json({ ok: true });
}
