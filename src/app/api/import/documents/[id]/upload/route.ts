import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadOwnBatch, notFound, requireImporter } from "@/lib/importer/access";
import { trackedClient } from "@/lib/importer/tracker";
import { EMPLOYEE_DOC_TYPES, SUPPLIER_DOC_TYPE_OPTIONS, extOf, MIME_BY_EXT } from "@/lib/importer/documentMatch";
import { MAX_BATCH_BYTES, MAX_BATCH_FILES, MAX_BULK_FILE_BYTES } from "@/lib/importer/documentLimits";
import { safeFilename } from "@/lib/uploads";
import { EXPIRY_FIELD, READ_FIELDS } from "@/lib/importer/documentRead";
import { normalizePhone } from "@/lib/phone";

export const maxDuration = 60;

type Meta = { name: string; ownerKind: "EMPLOYEE" | "SUPPLIER"; ownerId: string; type: string; expiry?: string | null; updateExpiry?: boolean; fields?: Record<string, string> };
export type UploadResult = { name: string; status: "created" | "duplicate" | "failed"; message?: string; recordUpdated?: boolean };

const EMP_TYPES = new Set(EMPLOYEE_DOC_TYPES.map((t) => t.value));
const SUP_TYPES = new Set(SUPPLIER_DOC_TYPE_OPTIONS.map((t) => t.value));

/** Files one small group of documents against the people and suppliers chosen on the review screen. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const batch = await loadOwnBatch((await params).id, who.branchId);
  if (!batch || batch.kind !== "DOCUMENTS") return notFound();
  if (batch.status !== "RUNNING") return NextResponse.json({ error: "This upload is already finished." }, { status: 409 });

  const form = await request.formData().catch(() => null);
  const metas = (() => { try { return JSON.parse(String(form?.get("meta") ?? "[]")) as Meta[]; } catch { return []; } })();
  if (!form || !Array.isArray(metas) || metas.length === 0 || metas.length > MAX_BATCH_FILES) return NextResponse.json({ error: "Nothing to upload." }, { status: 400 });

  const empIds = [...new Set(metas.filter((m) => m.ownerKind === "EMPLOYEE").map((m) => m.ownerId))];
  const supIds = [...new Set(metas.filter((m) => m.ownerKind === "SUPPLIER").map((m) => m.ownerId))];
  const [emps, sups] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: empIds }, branchId: who.branchId }, select: { id: true } }),
    prisma.supplier.findMany({ where: { id: { in: supIds }, branchId: who.branchId }, select: { id: true } }),
  ]);
  const okEmp = new Set(emps.map((e) => e.id)), okSup = new Set(sups.map((s) => s.id));
  const startSeq = await prisma.importChange.count({ where: { batchId: batch.id } });
  const db = trackedClient(batch.id, startSeq);

  // What the document says also feeds the record: a field is filled only when it is empty, and an expiry
  // only when it is empty or older. Nothing already on the record is ever overwritten with something else.
  const syncRecord = async (kind: "EMPLOYEE" | "SUPPLIER", id: string, type: string, expiry: Date | null, read: Record<string, string> | undefined): Promise<boolean> => {
    const allowed = READ_FIELDS[kind];
    const incoming: Record<string, string> = {};
    for (const k of allowed.text) { const v = read?.[k]; if (typeof v === "string" && v.trim()) incoming[k] = v.trim().slice(0, 120); }
    for (const k of allowed.dates) { const v = read?.[k]; if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) incoming[k] = v; }
    const own = EXPIRY_FIELD[kind][type];
    if (own && expiry) incoming[own] = expiry.toISOString().slice(0, 10); // the date shown on the review screen wins for its own field
    const keys = Object.keys(incoming);
    if (keys.length === 0) return false;
    const select = Object.fromEntries(keys.map((k) => [k, true]));
    const cur = (kind === "EMPLOYEE"
      ? await prisma.employee.findUnique({ where: { id }, select: select as never })
      : await prisma.supplier.findUnique({ where: { id }, select: select as never })) as Record<string, unknown> | null;
    if (!cur) return false;
    const data: Record<string, unknown> = {};
    for (const k of keys) {
      const have = cur[k], val = incoming[k];
      if (allowed.dates.includes(k) && k !== "dateOfBirth") {
        const d = new Date(`${val}T00:00:00.000Z`);
        if (!Number.isNaN(d.getTime()) && (!have || (have as Date) < d)) data[k] = d;
      } else if (k === "dateOfBirth") {
        const d = new Date(`${val}T00:00:00.000Z`);
        if (!have && !Number.isNaN(d.getTime())) data[k] = d;
      } else if (!have) {
        if (k === "gender") { const g = val.toUpperCase(); if (g === "MALE" || g === "FEMALE") data[k] = g; }
        else if (k === "mobileNumber") { const p = normalizePhone(val); if (p) data[k] = p; }
        else data[k] = val;
      }
    }
    if (Object.keys(data).length === 0) return false;
    if (kind === "EMPLOYEE") await db.employee.update({ where: { id }, data });
    else await db.supplier.update({ where: { id }, data });
    return true;
  };

  let total = 0;
  const results: UploadResult[] = [];
  for (let i = 0; i < metas.length; i++) {
    const m = metas[i];
    const file = form.get(`file${i}`);
    const name = String(m?.name ?? (file instanceof File ? file.name : "file"));
    let updated = false;
    try {
      if (!(file instanceof File) || file.size === 0) throw new Error("The file didn't arrive.");
      total += file.size;
      if (file.size > MAX_BULK_FILE_BYTES || total > MAX_BATCH_BYTES + MAX_BULK_FILE_BYTES) throw new Error("Too large.");
      const mime = MIME_BY_EXT[extOf(file.name)];
      if (!mime) throw new Error("Not a supported file type.");
      const expiry = m.expiry && /^\d{4}-\d{2}-\d{2}$/.test(m.expiry) ? new Date(`${m.expiry}T00:00:00.000Z`) : null;
      const filename = safeFilename(file.name);
      const bytes = Buffer.from(await file.arrayBuffer());
      if (m.ownerKind === "EMPLOYEE") {
        if (!okEmp.has(m.ownerId)) throw new Error("That worker isn't in this company.");
        const type = EMP_TYPES.has(m.type) ? m.type : "OTHER";
        // The same file filed twice would only clutter the profile.
        if (await prisma.document.findFirst({ where: { employeeId: m.ownerId, type, filename }, select: { id: true } })) { results.push({ name, status: "duplicate", message: "Already on file." }); continue; }
        await db.document.create({ data: { employeeId: m.ownerId, type, filename, fileData: bytes, mimeType: mime, expiryDate: expiry, uploadedById: who.user.id } });
        if (m.updateExpiry) updated = await syncRecord("EMPLOYEE", m.ownerId, type, expiry, m.fields);
      } else if (m.ownerKind === "SUPPLIER") {
        if (!okSup.has(m.ownerId)) throw new Error("That supplier isn't in this company.");
        const docType = SUP_TYPES.has(m.type) ? m.type : "OTHER";
        if (await prisma.attachment.findFirst({ where: { entityType: "SUPPLIER", entityId: m.ownerId, docType, filename }, select: { id: true } })) { results.push({ name, status: "duplicate", message: "Already on file." }); continue; }
        await db.attachment.create({ data: { entityType: "SUPPLIER", entityId: m.ownerId, docType, filename, fileData: bytes, mimeType: mime, expiryDate: expiry, branchId: who.branchId, uploadedById: who.user.id } });
        if (m.updateExpiry) updated = await syncRecord("SUPPLIER", m.ownerId, docType, expiry, m.fields);
      } else throw new Error("No owner chosen.");
      results.push({ name, status: "created", recordUpdated: updated });
    } catch (e) {
      results.push({ name, status: "failed", message: e instanceof Error ? e.message : "Could not be saved." });
    }
  }
  await prisma.importBatch.update({ where: { id: batch.id }, data: { progressDone: { increment: results.length } } });
  return NextResponse.json({ results });
}
