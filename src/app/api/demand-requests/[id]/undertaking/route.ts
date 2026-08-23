import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { generateLetterPdf } from "@/lib/generateLetterPdf";
import { buildLetterSections, toLetterWorker } from "@/lib/letterIssuer";

/**
 * Undertaking letter for a demand's mobilised workers.
 *
 * Same shape and the same splitting as the NOC — an undertaking is one
 * company accepting responsibility for its own people, so a mobilisation
 * drawn from three suppliers produces three letters. `?letterhead=1` prints
 * each on that company's own letterhead.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const { id } = await params;
  const url = new URL(request.url);
  const templateId = url.searchParams.get("templateId") || "";
  const onLetterhead = url.searchParams.get("letterhead") === "1";

  const demand = await prisma.demandRequest.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      branch: true,
      trades: {
        include: {
          allocations: {
            include: {
              employee: { include: { supplier: { select: { name: true, fullName: true } } } },
            },
          },
        },
      },
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

  const { sections, missingLetterheads } = await buildLetterSections({
    workers: workers.map(toLetterWorker),
    templateBody: template.remarksText,
    onLetterhead,
    fallbackIssuerName: demand.branch.name,
    context: {
      clientName: demand.client.name,
      clientAddress: demand.client.billingAddress,
      projectName: demand.project.name,
      branchName: demand.branch.name,
      docNo: demand.requestNo,
      mobilizeDate: null,
      date: new Date(),
    },
  });

  const buffer = await generateLetterPdf({
    title: template.category ?? "Undertaking Letter",
    clientName: demand.client.name,
    clientAddress: demand.client.billingAddress,
    projectName: demand.project.name,
    date: new Date(),
    sections,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="UND-${demand.requestNo}.pdf"`,
      ...(missingLetterheads.length
        ? { "X-Letterhead-Missing": encodeURIComponent(missingLetterheads.join(", ")) }
        : {}),
    },
  });
}
