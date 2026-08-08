import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { substituteMergeFields } from "@/lib/mergeFields";
import { generateNocLetterPdf } from "@/lib/generateNocPdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const noc = await prisma.noc.findUnique({
    where: { id },
    include: {
      template: true,
      branch: true,
      demandRequest: { include: { client: true, project: true } },
      employees: { include: { employee: true } },
    },
  });

  if (!noc || isOutsideBranch(noc.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "NOC not found." }, { status: 404 });
  }

  const mergeValues: Record<string, string> = {
    CLIENTNAME: noc.demandRequest.client.name,
    PROJECTNAME: noc.demandRequest.project.name,
    SPONSORSHIPCOMPANYNAME: noc.demandRequest.project.sponsorshipCompany ?? "",
    BRANCHNAME: noc.branch.name,
    DOCNO: String(noc.docNo),
    MOBILIZEDATE: noc.mobilizeDate ? noc.mobilizeDate.toLocaleDateString("en-GB") : "",
  };

  const bodyText = substituteMergeFields(noc.template.remarksText, mergeValues);
  const displayFields = noc.displayFields ? noc.displayFields.split(",") : [];

  const buffer = await generateNocLetterPdf({
    branchName: noc.branch.name,
    branchAddress: noc.branch.address,
    docNo: noc.docNo,
    bodyText,
    displayFields,
    employees: noc.employees.map((ne) => ({
      employeeIdNo: ne.employee.employeeIdNo,
      name: ne.employee.name,
      passportNumber: ne.employee.passportNumber,
      nationality: ne.employee.nationality,
      trade: ne.employee.trade,
      emiratesId: ne.employee.emiratesId,
      visaStatus: ne.employee.visaStatus,
    })),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="NOC-${noc.docNo}.pdf"`,
    },
  });
}
