import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { PACK_SECTIONS, packSafeName } from "@/lib/mobilisationPack";

/**
 * Zips the selected documents for everyone mobilised on a demand.
 *
 * One file per worker per section, foldered by worker so a client receiving it
 * can find a person rather than sifting a flat list. Company documents (trade
 * licence, workmen's compensation) are the same file for many workers, so they
 * go in one shared folder instead of being duplicated per person.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const { id } = await params;

  const url = new URL(request.url);
  const wanted = new Set(url.searchParams.getAll("section"));
  const sections = PACK_SECTIONS.filter((s) => wanted.has(s.key));
  if (sections.length === 0) {
    return NextResponse.json({ error: "Pick at least one document." }, { status: 400 });
  }

  const demand = await prisma.demandRequest.findUnique({
    where: { id },
    include: {
      client: true,
      trades: {
        include: {
          allocations: {
            include: {
              employee: {
                include: {
                  documents: {
                    select: { id: true, type: true, filename: true, mimeType: true },
                  },
                  supplier: { select: { id: true, name: true } },
                  sponsorshipCompany: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!demand || isOutsideBranch(demand.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const workers = demand.trades.flatMap((t) => t.allocations.map((a) => a.employee));
  if (workers.length === 0) {
    return NextResponse.json(
      { error: "Nobody is mobilised on this demand yet." },
      { status: 400 }
    );
  }

  const zip = new JSZip();
  const missing: string[] = [];

  // Company documents are fetched once per company, not once per worker.
  const companySections = sections.filter((s) => s.companyTypes);
  if (companySections.length > 0) {
    const companyIds = new Set<string>();
    for (const w of workers) {
      // Sponsorship company first — it holds the visa — then the employer.
      if (w.sponsorshipCompany) companyIds.add(w.sponsorshipCompany.id);
      if (w.supplier) companyIds.add(w.supplier.id);
    }

    for (const section of companySections) {
      const files = await prisma.attachment.findMany({
        where: { entityId: { in: [...companyIds] }, docType: { in: section.companyTypes! } },
        select: { filename: true, fileData: true, entityId: true },
      });
      if (files.length === 0) {
        missing.push(section.label);
        continue;
      }
      for (const file of files) {
        zip.file(
          `Company documents/${packSafeName(section.label)}/${packSafeName(file.filename)}`,
          file.fileData
        );
      }
    }
  }

  const employeeSections = sections.filter((s) => s.employeeTypes);
  for (const worker of workers) {
    const folder = `${packSafeName(worker.employeeIdNo)} ${packSafeName(worker.name)}`;
    for (const section of employeeSections) {
      // First match wins: the section lists its fallbacks in priority order.
      const match = section.employeeTypes!.map((type) =>
        worker.documents.find((d) => d.type === type)
      ).find(Boolean);

      if (!match) {
        missing.push(`${worker.employeeIdNo} — ${section.label}`);
        continue;
      }
      const doc = await prisma.document.findUnique({
        where: { id: match.id },
        select: { fileData: true, filename: true },
      });
      if (!doc) continue;
      zip.file(
        `${folder}/${packSafeName(section.label)} - ${packSafeName(doc.filename)}`,
        doc.fileData
      );
    }
  }

  // A manifest, so whoever opens the zip can see what wasn't on file rather
  // than assuming the pack is complete.
  const lines = [
    `Mobilisation pack — Request #${demand.requestNo}`,
    `Client: ${demand.client.name}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Workers: ${workers.length}`,
    `Sections: ${sections.map((s) => s.label).join(", ")}`,
    "",
    missing.length > 0 ? "NOT ON FILE:" : "Every selected document was found.",
    ...missing.map((m) => `  - ${m}`),
  ];
  zip.file("MANIFEST.txt", lines.join("\n"));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="mobilisation-${demand.requestNo}.zip"`,
    },
  });
}
