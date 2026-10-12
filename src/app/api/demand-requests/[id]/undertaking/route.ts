import { NextResponse } from "next/server";
import { templateHtml } from "@/lib/letterHtml";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { generateLetterPdf } from "@/lib/generateLetterPdf";
import { buildLetterSections, toLetterWorker } from "@/lib/letterIssuer";

/**
 * Undertaking letter for a demand's mobilised workers.
 *
 * Issued by our own company, so it is one letter for everyone mobilised, and
 * `?letterhead=1` prints it on the letterhead saved in Settings → Company profile.
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
  // Optional: a subset of the mobilised workers, and how the signature block is printed.
  const only = new Set(url.searchParams.getAll("employee"));
  const signing = {
    signatoryName: url.searchParams.get("signatoryName"),
    signatoryTitle: url.searchParams.get("signatoryTitle"),
    showSignature: url.searchParams.get("signature") === "1",
    showStamp: url.searchParams.get("stamp") === "1",
  };

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

  const workers = demand.trades.flatMap((t) => t.allocations.map((a) => a.employee)).filter((e) => only.size === 0 || only.has(e.id));
  if (workers.length === 0) {
    return NextResponse.json(
      { error: "Nobody is mobilised on this demand yet." },
      { status: 400 }
    );
  }

  const { sections, missingLetterheads } = await buildLetterSections({
    workers: workers.map(toLetterWorker),
    templateHtml: templateHtml(template),
    onLetterhead,
    fallbackIssuerName: demand.branch.name,
    issuedBy: "COMPANY",
    branchId: demand.branchId,
    signing,
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
    title: template.title || template.category || "Undertaking Letter",
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
