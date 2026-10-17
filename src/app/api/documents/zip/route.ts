import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { safeFilename } from "@/lib/uploads";

const MAX_DOCUMENTS = 100;

/** The chosen documents as one ZIP, each file named for its worker and type. Branch-checked like the single download. */
export async function GET(request: Request) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const ids = [...new Set(new URL(request.url).searchParams.get("ids")?.split(",").filter(Boolean) ?? [])];
  if (ids.length === 0) return NextResponse.json({ error: "No documents chosen." }, { status: 400 });
  if (ids.length > MAX_DOCUMENTS) return NextResponse.json({ error: `Choose up to ${MAX_DOCUMENTS} documents at a time.` }, { status: 400 });

  const docs = await prisma.document.findMany({
    where: { id: { in: ids } },
    include: { employee: { select: { name: true, employeeIdNo: true, branchId: true } } },
  });
  const visible = docs.filter((d) => !isOutsideBranch(d.employee.branchId, branchId, isSuperAdmin));
  if (visible.length === 0) return NextResponse.json({ error: "Documents not found." }, { status: 404 });

  const zip = new JSZip();
  const used = new Set<string>();
  for (const d of visible) {
    const base = safeFilename(`${d.employee.employeeIdNo} ${d.employee.name} - ${d.type.replace(/_/g, " ")} - ${d.filename}`);
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = base.replace(/(\.[^.]*)?$/, ` (${n})$1`);
    used.add(name.toLowerCase());
    zip.file(name, d.fileData);
  }
  const body = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="documents-${new Date().toISOString().slice(0, 10)}.zip"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
