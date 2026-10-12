import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderSample } from "@/lib/timesheetSample";
import { resolveTemplate } from "@/lib/timesheetTemplateApply";

/** A sample of a layout with made-up workers, for the Templates tab: a built-in layout, or one of the company's own. */
export async function GET(request: Request) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";
  const chosen = await resolveTemplate(url.searchParams.get("template") ?? "", branchId, isSuperAdmin);
  if (!chosen) return NextResponse.json({ error: "Unknown template." }, { status: 400 });

  const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId } }) : null;
  const buffer = await renderSample(chosen.base, chosen.config, format, branch);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="sample-${chosen.name.replace(/[^a-z0-9]+/gi, "-")}.${format}"`,
    },
  });
}
