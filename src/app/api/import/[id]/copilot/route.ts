import { NextResponse } from "next/server";
import { loadOwnBatch, notFound, requireImporter } from "@/lib/importer/access";
import { runTimesheetCopilot } from "@/lib/importer/copilot";
import { rateLimit } from "@/lib/rateLimit";

export const maxDuration = 60;

/** Reads the uploaded timesheet and says what looks wrong before anything is imported. Advice only; nothing is changed. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const batch = await loadOwnBatch((await params).id, who.branchId);
  if (!batch) return notFound();
  if (batch.kind !== "TIMESHEETS") return NextResponse.json({ error: "The AI check is only available for timesheets so far." }, { status: 400 });
  if (!batch.fileData) return NextResponse.json({ error: "This import has already finished." }, { status: 409 });

  const limit = rateLimit(`import-copilot:${who.user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "You've run the check a lot — try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  const body = (await request.json().catch(() => ({}))) as { timesheetOverrides?: Record<string, string> };
  try {
    const result = await runTimesheetCopilot({ buffer: Buffer.from(batch.fileData), branchId: who.branchId, overrides: body.timesheetOverrides ?? {} });
    return NextResponse.json({ result });
  } catch (e) {
    console.error("[import-copilot] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The check could not read this file." }, { status: 500 });
  }
}
