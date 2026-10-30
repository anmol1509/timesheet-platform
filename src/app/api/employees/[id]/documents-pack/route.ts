import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { safeFilename } from "@/lib/uploads";

/** Every file on record for one worker (passport, visa, Emirates ID and the rest) as a single ZIP. Branch-checked like the single download. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      name: true,
      employeeIdNo: true,
      branchId: true,
      // Files attached to a note belong to that note, not to the worker's document set.
      documents: { where: { noteId: null }, orderBy: { uploadedAt: "desc" }, select: { type: true, filename: true, fileData: true } },
    },
  });
  // Same 404 for "no such worker" and "not yours", so ids can't be probed.
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }
  if (employee.documents.length === 0) return NextResponse.json({ error: "No documents on file for this worker." }, { status: 404 });

  const zip = new JSZip();
  const used = new Set<string>();
  for (const d of employee.documents) {
    const base = safeFilename(`${d.type.replace(/_/g, " ")} - ${d.filename}`);
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = base.replace(/(\.[^.]*)?$/, ` (${n})$1`);
    used.add(name.toLowerCase());
    zip.file(name, d.fileData);
  }
  const body = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const label = safeFilename(`${employee.employeeIdNo} ${employee.name} documents`).replace(/[^\w .-]/g, "");
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${label}.zip"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
