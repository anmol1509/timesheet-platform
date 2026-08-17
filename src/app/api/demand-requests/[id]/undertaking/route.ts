import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { substituteMergeFields } from "@/lib/mergeFields";
import { generateNocLetterPdf } from "@/lib/generateNocPdf";
import { NOC_DISPLAY_FIELDS } from "@/lib/nocDisplayFields";

/**
 * Undertaking letter for a demand's mobilised workers.
 *
 * Same shape as the NOC — letterhead, body, worker table — so it reuses that
 * renderer. The body text comes from the chosen Letter Template, which is where
 * the approved wording is maintained; nothing is hardcoded here.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const { id } = await params;
  const templateId = new URL(request.url).searchParams.get("templateId") || "";

  const demand = await prisma.demandRequest.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      branch: true,
      trades: { include: { allocations: { include: { employee: true } } } },
    },
  });
  if (!demand || isOutsideBranch(demand.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const template = await prisma.letterTemplate.findUnique({ where: { id: templateId } });
  if (!template || isOutsideBranch(template.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const workers = demand.trades.flatMap((t) => t.allocations.map((a) => a.employee));
  if (workers.length === 0) {
    return NextResponse.json(
      { error: "Nobody is mobilised on this demand yet." },
      { status: 400 }
    );
  }

  const bodyText = substituteMergeFields(template.remarksText, {
    CLIENTNAME: demand.client.name,
    PROJECTNAME: demand.project.name,
    SPONSORSHIPCOMPANYNAME: demand.project.sponsorshipCompany ?? "",
    BRANCHNAME: demand.branch.name,
    DOCNO: String(demand.requestNo),
    MOBILIZEDATE: new Date().toLocaleDateString("en-GB"),
  });

  const buffer = await generateNocLetterPdf({
    branchName: demand.branch.name,
    branchAddress: demand.branch.address,
    docPrefix: "UND",
    docNo: demand.requestNo,
    bodyText,
    // Every column the letter can show — an undertaking lists the workers it
    // covers, so there's nothing to choose between here.
    displayFields: NOC_DISPLAY_FIELDS.map((f) => f.key),
    employees: workers.map((e) => ({
      employeeIdNo: e.employeeIdNo,
      name: e.name,
      passportNumber: e.passportNumber,
      nationality: e.nationality,
      trade: e.trade,
      emiratesId: e.emiratesId,
      visaStatus: e.visaStatus,
    })),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="UND-${demand.requestNo}.pdf"`,
    },
  });
}
