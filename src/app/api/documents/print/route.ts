import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";

const MAX_DOCUMENTS = 300;
const A4: [number, number] = [595.28, 841.89];
/** Supplier documents are named "att:<id>" so they can sit in the same list as worker documents. */
const ATT = "att:";

type Item = { key: string; bytes: Uint8Array; mimeType: string; label: string };

const asciiLabel = (s: string) => s.replace(/[^\x20-\x7E]/g, "?");
const typeName = (t: string) => t.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * The chosen documents joined into one PDF to print: PDFs as they are, photos and scans one per A4 page with the
 * owner's name above. Worker documents are plain ids; a supplier's own documents (trade licence, VAT certificate,
 * workmen compensation...) are "att:<id>". Anything that isn't a PDF or an image is counted in a response header.
 */
async function build(ids: string[]): Promise<NextResponse> {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return NextResponse.json({ error: "No documents chosen." }, { status: 400 });
  if (unique.length > MAX_DOCUMENTS) return NextResponse.json({ error: `Choose up to ${MAX_DOCUMENTS} documents at a time.` }, { status: 400 });

  const docIds = unique.filter((i) => !i.startsWith(ATT));
  const attIds = unique.filter((i) => i.startsWith(ATT)).map((i) => i.slice(ATT.length));
  const [docs, atts] = await Promise.all([
    docIds.length ? prisma.document.findMany({ where: { id: { in: docIds } }, include: { employee: { select: { name: true, employeeIdNo: true, branchId: true } } } }) : [],
    attIds.length ? prisma.attachment.findMany({ where: { id: { in: attIds }, entityType: "SUPPLIER" } }) : [],
  ]);
  const suppliers = atts.length ? await prisma.supplier.findMany({ where: { id: { in: [...new Set(atts.map((a) => a.entityId))] } }, select: { id: true, name: true } }) : [];
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  const byKey = new Map<string, Item>();
  for (const d of docs) {
    if (isOutsideBranch(d.employee.branchId, branchId, isSuperAdmin)) continue;
    byKey.set(d.id, { key: d.id, bytes: new Uint8Array(d.fileData), mimeType: d.mimeType, label: `${d.employee.name} (${d.employee.employeeIdNo}) - ${typeName(d.type)}` });
  }
  for (const a of atts) {
    if (isOutsideBranch(a.branchId, branchId, isSuperAdmin)) continue;
    byKey.set(ATT + a.id, { key: ATT + a.id, bytes: new Uint8Array(a.fileData), mimeType: a.mimeType, label: `${supplierName.get(a.entityId) ?? "Supplier"} - ${typeName(a.docType)}` });
  }
  const ordered = unique.map((k) => byKey.get(k)).filter((d): d is Item => !!d);
  if (ordered.length === 0) return NextResponse.json({ error: "Documents not found." }, { status: 404 });

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  let skipped = 0;
  for (const d of ordered) {
    try {
      if (d.mimeType === "application/pdf") {
        const src = await PDFDocument.load(d.bytes, { ignoreEncryption: true });
        for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
      } else if (d.mimeType === "image/jpeg" || d.mimeType === "image/png") {
        const image = d.mimeType === "image/png" ? await out.embedPng(d.bytes) : await out.embedJpg(d.bytes);
        const page = out.addPage(A4);
        const margin = 36;
        page.drawText(asciiLabel(d.label), { x: margin, y: A4[1] - margin, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
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

export async function GET(request: Request) {
  return build(new URL(request.url).searchParams.get("ids")?.split(",") ?? []);
}

/** Longer lists (many workers at once) are sent as a form post, since they would overflow a web address. */
export async function POST(request: Request) {
  const form = await request.formData();
  return build(String(form.get("ids") ?? "").split(","));
}
