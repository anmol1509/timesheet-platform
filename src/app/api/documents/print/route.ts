import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";

const MAX_DOCUMENTS = 100;
const A4: [number, number] = [595.28, 841.89];

/**
 * The chosen documents joined into one PDF to print: PDFs as they are, photos and scans one per A4 page with the
 * worker's name above. Anything else (Word, Excel) can't be printed here and is counted in a response header.
 */
export async function GET(request: Request) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const ids = [...new Set(new URL(request.url).searchParams.get("ids")?.split(",").filter(Boolean) ?? [])];
  if (ids.length === 0) return NextResponse.json({ error: "No documents chosen." }, { status: 400 });
  if (ids.length > MAX_DOCUMENTS) return NextResponse.json({ error: `Choose up to ${MAX_DOCUMENTS} documents at a time.` }, { status: 400 });

  const docs = await prisma.document.findMany({
    where: { id: { in: ids } },
    include: { employee: { select: { name: true, employeeIdNo: true, branchId: true } } },
  });
  const byId = new Map(docs.filter((d) => !isOutsideBranch(d.employee.branchId, branchId, isSuperAdmin)).map((d) => [d.id, d]));
  const ordered = ids.map((id) => byId.get(id)).filter((d): d is NonNullable<typeof d> => !!d);
  if (ordered.length === 0) return NextResponse.json({ error: "Documents not found." }, { status: 404 });

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  let skipped = 0;
  for (const d of ordered) {
    try {
      const bytes = new Uint8Array(d.fileData);
      if (d.mimeType === "application/pdf") {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
      } else if (d.mimeType === "image/jpeg" || d.mimeType === "image/png") {
        const image = d.mimeType === "image/png" ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const page = out.addPage(A4);
        const margin = 36;
        const label = `${d.employee.name} (${d.employee.employeeIdNo}) - ${d.type.replace(/_/g, " ")}`.replace(/[^\x20-\x7E]/g, "?");
        page.drawText(label, { x: margin, y: A4[1] - margin, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
        const maxW = A4[0] - margin * 2;
        const maxH = A4[1] - margin * 2 - 20;
        const scale = Math.min(maxW / image.width, maxH / image.height, 1.5);
        const w = image.width * scale, h = image.height * scale;
        page.drawImage(image, { x: (A4[0] - w) / 2, y: A4[1] - margin - 20 - h, width: w, height: h });
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }
  if (out.getPageCount() === 0) return NextResponse.json({ error: "None of these files can be printed (only PDF and image files can)." }, { status: 422 });
  return new NextResponse(new Uint8Array(await out.save()), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="documents.pdf"',
      "X-Content-Type-Options": "nosniff",
      "X-Skipped-Files": String(skipped),
    },
  });
}
