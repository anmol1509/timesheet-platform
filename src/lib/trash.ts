import { canRecover } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { EMPLOYEE_CHILDREN } from "@/lib/trashConfig";
import { reviveRow, serialiseRow, snapshotSize, type ColumnInfo } from "@/lib/trashSerialise";

/**
 * "Recently deleted": a worker, a worker's document or an attached file is copied here just before it is deleted, and
 * can be restored for TRASH_DAYS. The copy holds the row and everything that was deleted along with it, files included.
 * Only things that are deleted outright are kept: restoring puts the data back, not any other record that changed
 * because of the delete (a bed that was freed stays free).
 */

export const TRASH_DAYS = 30;
const MAX_SNAPSHOT_BYTES = 60 * 1024 * 1024;

/** Links on a worker that point at other records which may have been deleted since; they are cleared rather than blocking the restore. */
const OPTIONAL_LINKS = [
  ["supplierId", "supplier"], ["sponsorSupplierId", "supplier"], ["projectId", "project"], ["siteId", "site"], ["vehicleId", "vehicle"],
] as const;

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const db = prisma as unknown as Any;

function columnsOf(model: string): Record<string, ColumnInfo> {
  const dm = (prisma as unknown as { _runtimeDataModel?: { models: Record<string, { fields: { name: string; kind: string; type: string }[] }> } })._runtimeDataModel;
  const m = dm?.models?.[model];
  if (!m) throw new Error(`No model ${model}`);
  return Object.fromEntries(m.fields.map((f) => [f.name, { kind: f.kind, type: f.type }]));
}

type Who = { id: string; name: string; branchId: string | null };
export type TrashResult = { ok: true; id: string } | { ok: false; error: string };

const expiry = () => new Date(Date.now() + TRASH_DAYS * 86_400_000);

/** Removes copies older than the retention period. Cheap, so it runs whenever something is deleted or the list is opened. */
export async function purgeExpired() {
  await prisma.deletedRecord.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => null);
}

async function save(kind: "EMPLOYEE" | "DOCUMENT" | "ATTACHMENT", recordId: string, label: string, detail: string | null, snapshot: unknown, branchId: string | null, who: Who): Promise<TrashResult> {
  const size = snapshotSize(snapshot);
  if (size > MAX_SNAPSHOT_BYTES) return { ok: false, error: "That is too large to keep a restorable copy of, so it was not deleted." };
  try {
    const row = await prisma.deletedRecord.create({
      data: { kind, recordId, label, detail, snapshot: snapshot as object, sizeBytes: Math.min(size, 2_000_000_000), branchId, deletedById: who.id, deletedByName: who.name, expiresAt: expiry() },
      select: { id: true },
    });
    void purgeExpired();
    return { ok: true, id: row.id };
  } catch (e) {
    console.error("[trash] could not keep a copy:", e instanceof Error ? e.message : e);
    return { ok: false, error: "A restorable copy couldn't be saved, so it was not deleted." };
  }
}

/** Keeps a copy of a worker and everything deleted with them. Call before the delete; if it fails, do not delete. */
export async function trashEmployee(employeeId: string, who: Who): Promise<TrashResult> {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return { ok: false, error: "That worker no longer exists." };
  const children: Record<string, unknown[]> = {};
  for (const c of EMPLOYEE_CHILDREN) {
    const rows = (await db[c.delegate].findMany({ where: { [c.fk]: employeeId } })) as Any[];
    const cols = columnsOf(c.model);
    children[c.model] = rows.map((r) => serialiseRow(r, cols));
  }
  const drives = await prisma.vehicle.findMany({ where: { driverEmployeeId: employeeId }, select: { id: true } });
  const snapshot = { row: serialiseRow(emp as unknown as Any, columnsOf("Employee")), children, drives: drives.map((v) => v.id) };
  const docs = children.Document?.length ?? 0;
  return save("EMPLOYEE", emp.id, `${emp.name} (${emp.employeeIdNo})`, [emp.trade, docs ? `${docs} document${docs === 1 ? "" : "s"}` : null].filter(Boolean).join(", ") || null, snapshot, emp.branchId, who);
}

/** Keeps a copy of a worker's documents. All or nothing: one that can't be kept stops the whole delete. */
export async function trashDocuments(ids: string[], who: Who): Promise<TrashResult> {
  if (ids.length === 0) return { ok: true, id: "" };
  const docs = await prisma.document.findMany({ where: { id: { in: ids } }, include: { employee: { select: { name: true, employeeIdNo: true, branchId: true } } } });
  const cols = columnsOf("Document");
  let total = 0;
  const made: string[] = [];
  for (const d of docs) {
    const { employee, ...row } = d as Any;
    const snapshot = { row: serialiseRow(row, cols) };
    total += snapshotSize(snapshot);
    if (total > MAX_SNAPSHOT_BYTES) {
      if (made.length) await prisma.deletedRecord.deleteMany({ where: { id: { in: made } } }).catch(() => null);
      return { ok: false, error: "Those documents are too large to keep restorable copies of in one go. Delete fewer at once." };
    }
    const r = await save("DOCUMENT", d.id, d.filename, `${labelOfType(d.type)} of ${employee.name} (${employee.employeeIdNo})`, snapshot, employee.branchId, who);
    if (!r.ok) {
      if (made.length) await prisma.deletedRecord.deleteMany({ where: { id: { in: made } } }).catch(() => null);
      return r;
    }
    made.push(r.id);
  }
  return { ok: true, id: made[0] ?? "" };
}

/** Keeps a copy of a file attached to a supplier, vehicle, client, project and so on. */
export async function trashAttachment(attachmentId: string, who: Who): Promise<TrashResult> {
  const a = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!a) return { ok: false, error: "That file no longer exists." };
  return save("ATTACHMENT", a.id, a.filename, `${labelOfType(a.docType)}, attached to a ${a.entityType.toLowerCase().replace(/_/g, " ")}`, { row: serialiseRow(a as unknown as Any, columnsOf("Attachment")) }, a.branchId, who);
}

const labelOfType = (t: string) => t.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export type RestoreResult = { ok: true; label: string; href: string | null; notes: string[] } | { ok: false; error: string };

/** Puts a deleted record back, with what was deleted along with it. Nothing is changed if any part can't go back. */
export async function restoreDeleted(id: string, who: Who & { role: string; permissions?: string[] | null }): Promise<RestoreResult> {
  if (!canRecover(who, "edit")) return { ok: false, error: "You don't have permission to restore deleted records." };
  const rec = await prisma.deletedRecord.findUnique({ where: { id } });
  if (!rec) return { ok: false, error: "That entry is gone. Copies are kept for 30 days." };
  if (who.branchId && rec.branchId !== who.branchId) return { ok: false, error: "That belongs to another company." };
  if (rec.restoredAt) return { ok: false, error: `Already restored by ${rec.restoredByName ?? "someone"}.` };
  if (rec.expiresAt < new Date()) return { ok: false, error: "The copy has expired." };

  const snap = rec.snapshot as { row: Record<string, unknown>; children?: Record<string, Record<string, unknown>[]>; drives?: string[] };
  const notes: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      const t = tx as unknown as Any;
      if (rec.kind === "EMPLOYEE") {
        const row = reviveRow(snap.row, columnsOf("Employee"));
        if (await t.employee.findUnique({ where: { id: rec.recordId }, select: { id: true } })) throw new Error("This worker is already back on file.");
        const clash = await t.employee.findUnique({ where: { employeeIdNo: row.employeeIdNo }, select: { name: true } });
        if (clash) throw new Error(`The worker ID ${row.employeeIdNo} is now used by ${clash.name}, so this worker can't be put back with the same ID.`);
        for (const [field, delegate] of OPTIONAL_LINKS) {
          const target = row[field];
          if (typeof target === "string" && target && !(await t[delegate].findUnique({ where: { id: target }, select: { id: true } }))) {
            row[field] = null;
            notes.push(`The ${field.replace(/Id$/, "").replace(/([A-Z])/g, " $1").toLowerCase()} it was linked to no longer exists, so that link is empty.`);
          }
        }
        await t.employee.create({ data: row });
        for (const c of EMPLOYEE_CHILDREN) {
          const cols = columnsOf(c.model);
          const rows = (snap.children?.[c.model] ?? []).map((r) => reviveRow(r, cols));
          if (rows.length) await t[c.delegate].createMany({ data: rows, skipDuplicates: true });
        }
        if (snap.drives?.length) {
          const r = await t.vehicle.updateMany({ where: { id: { in: snap.drives }, driverEmployeeId: null }, data: { driverEmployeeId: rec.recordId } });
          if (r.count < snap.drives.length) notes.push("A vehicle they drove now has another driver, so it was left alone.");
        }
        notes.push("Their bed was freed when they were deleted and has not been given back.");
      } else if (rec.kind === "DOCUMENT") {
        const row = reviveRow(snap.row, columnsOf("Document"));
        if (await t.document.findUnique({ where: { id: rec.recordId }, select: { id: true } })) throw new Error("This document is already back on file.");
        if (!(await t.employee.findUnique({ where: { id: String(row.employeeId) }, select: { id: true } }))) throw new Error("The worker this document belonged to is no longer on file. Restore the worker first.");
        if (row.noteId && !(await t.employeeNote.findUnique({ where: { id: String(row.noteId) }, select: { id: true } }))) row.noteId = null;
        await t.document.create({ data: row });
      } else if (rec.kind === "ATTACHMENT") {
        const row = reviveRow(snap.row, columnsOf("Attachment"));
        if (await t.attachment.findUnique({ where: { id: rec.recordId }, select: { id: true } })) throw new Error("This file is already back.");
        await t.attachment.create({ data: row });
      } else throw new Error("Unknown kind of record.");
      await t.deletedRecord.update({ where: { id }, data: { restoredAt: new Date(), restoredByName: who.name } });
    }, { timeout: 60_000, maxWait: 10_000 });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2003") return { ok: false, error: "Something it was linked to has been deleted since, so it can't be put back as it was." };
    if (code === "P2002") return { ok: false, error: "Something with the same unique value now exists, so it can't be put back." };
    return { ok: false, error: e instanceof Error && !/Invalid `|prisma/i.test(e.message) ? e.message : "It couldn't be restored. Nothing was changed." };
  }

  const entityType = rec.kind === "EMPLOYEE" ? "EMPLOYEE" : rec.kind === "DOCUMENT" ? "DOCUMENT" : "ATTACHMENT";
  await logAudit({
    entityType, entityId: rec.recordId, action: "CREATE", after: { name: rec.label, restoredFromDeleted: "yes" },
    userId: who.id, userName: who.name, branchId: rec.branchId, source: "REVERT",
  });
  return { ok: true, label: rec.label, href: rec.kind === "EMPLOYEE" ? `/employees/${rec.recordId}` : null, notes };
}
