import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/db";
import { renderSample } from "@/lib/timesheetSample";
import { isTemplateKey } from "@/lib/timesheetTemplates";
import { normalizeConfig } from "@/lib/timesheetTemplateConfig";

export const maxDuration = 60;

const body = z.object({ baseKey: z.string(), config: z.unknown(), format: z.enum(["pdf", "xlsx"]).default("pdf") });

/** Draws the sheet being edited, with made-up workers, without saving anything. */
export async function POST(request: Request) {
  const { user, branchId } = await requireUserWithBranch();
  if (!isAdminRole(user.role)) return NextResponse.json({ error: "Only an administrator can edit templates." }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isTemplateKey(parsed.data.baseKey)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId } }) : null;
  try {
    const buffer = await renderSample(parsed.data.baseKey, normalizeConfig(parsed.data.baseKey, parsed.data.config), parsed.data.format, branch);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": parsed.data.format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "The preview couldn't be drawn." }, { status: 500 });
  }
}
