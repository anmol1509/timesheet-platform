import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadOwnBatch, notFound, requireImporter } from "@/lib/importer/access";
import { trackedClient } from "@/lib/importer/tracker";

type Body = { name?: string; passportNumber?: string; emiratesId?: string; trade?: string };

/** Adds a worker found in the documents, recorded in the same upload so undoing it removes the worker too. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const batch = await loadOwnBatch((await params).id, who.branchId);
  if (!batch || batch.kind !== "DOCUMENTS") return notFound();
  if (batch.status !== "RUNNING") return NextResponse.json({ error: "This upload is already finished." }, { status: 409 });
  const b = (await request.json().catch(() => null)) as Body | null;
  const name = String(b?.name ?? "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "A worker needs a name." }, { status: 400 });

  // The passport number or Emirates ID may already be on record: that worker is used instead of making a second one.
  const clash = await prisma.employee.findFirst({
    where: { branchId: who.branchId, OR: [...(b?.passportNumber ? [{ passportNumber: b.passportNumber.trim() }] : []), ...(b?.emiratesId ? [{ emiratesId: b.emiratesId.trim() }] : [])] },
    select: { id: true, name: true },
  });
  if (clash) return NextResponse.json({ id: clash.id, name: clash.name, existing: true });

  let code = "";
  for (let n = (await prisma.employee.count({ where: { employeeIdNo: { startsWith: "NEW-" } } })) + 1; n < 100000; n++) {
    code = `NEW-${String(n).padStart(4, "0")}`;
    if (!(await prisma.employee.findUnique({ where: { employeeIdNo: code }, select: { id: true } }))) break;
  }
  const startSeq = await prisma.importChange.count({ where: { batchId: batch.id } });
  const db = trackedClient(batch.id, startSeq);
  const created = await db.employee.create({
    data: {
      employeeIdNo: code, name, branchId: who.branchId,
      passportNumber: b?.passportNumber?.trim().slice(0, 40) || null, emiratesId: b?.emiratesId?.trim().slice(0, 40) || null, trade: b?.trade?.trim().slice(0, 80) || null,
    },
  });
  return NextResponse.json({ id: created.id, name: created.name, code, existing: false });
}
