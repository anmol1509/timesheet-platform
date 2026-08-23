import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { generateLetterPdf } from "@/lib/generateLetterPdf";
import { buildLetterSections, toLetterWorker } from "@/lib/letterIssuer";
import { columnsFromNocFields } from "@/lib/letterLayout";

/**
 * The NOC as a PDF, in the format the client's own letters use.
 *
 * `?letterhead=1` prints each company's letter on its own uploaded letterhead;
 * without it the layout is plain, for printing onto pre-printed paper.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const onLetterhead = new URL(request.url).searchParams.get("letterhead") === "1";

  const noc = await prisma.noc.findUnique({
    where: { id },
    include: {
      template: true,
      branch: true,
      demandRequest: { include: { client: true, project: true } },
      employees: {
        include: {
          employee: { include: { supplier: { select: { name: true, fullName: true } } } },
        },
      },
    },
  });

  if (!noc || isOutsideBranch(noc.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "NOC not found." }, { status: 404 });
  }

  const { sections, missingLetterheads } = await buildLetterSections({
    workers: noc.employees.map((ne) => toLetterWorker(ne.employee)),
    templateBody: noc.template.remarksText,
    onLetterhead,
    fallbackIssuerName: noc.branch.name,
    context: {
      clientName: noc.demandRequest.client.name,
      clientAddress: noc.demandRequest.client.billingAddress,
      projectName: noc.demandRequest.project.name,
      branchName: noc.branch.name,
      docNo: noc.docNo,
      mobilizeDate: noc.mobilizeDate,
      date: new Date(),
    },
  });

  if (sections.length === 0) {
    return NextResponse.json({ error: "This NOC lists no workers." }, { status: 400 });
  }

  const buffer = await generateLetterPdf({
    title: noc.template.category ?? "No Objection Certificate",
    clientName: noc.demandRequest.client.name,
    clientAddress: noc.demandRequest.client.billingAddress,
    projectName: noc.demandRequest.project.name,
    date: new Date(),
    sections,
    // The NOC screen's column picker still drives the table; the client's own
    // column set is what the default selection produces.
    columns: columnsFromNocFields(noc.displayFields ? noc.displayFields.split(",") : []),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="NOC-${noc.docNo}.pdf"`,
      // Surfaced rather than silently printing plain: the user asked for
      // letterhead and some companies had none on file.
      ...(missingLetterheads.length
        ? { "X-Letterhead-Missing": encodeURIComponent(missingLetterheads.join(", ")) }
        : {}),
    },
  });
}
