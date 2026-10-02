import { prisma } from "@/lib/db";
import { emitWebhookEvent } from "@/lib/webhooks/deliver";
import { describeTimesheetWorkbook } from "@/lib/parseTimesheet";
import { suggestMapping } from "./mapping";
import { describeSheets, extractRows, loadWorkbook } from "./sheet";
import { TARGETS } from "./targets";
import { trackedClient, undoChanges } from "./tracker";
import type { ApplyCtx, ApplyResult, Db, ImportKind } from "./types";
import { applySuppliers } from "./apply/suppliers";
import { suggestWorkerMatches } from "./workerAi";
import { applyCamps } from "./apply/camps";
import { applyVehicles } from "./apply/vehicles";
import { applyClients } from "./apply/clients";
import { applyWorkers } from "./apply/workers";
import { applyTimesheets } from "./apply/timesheets";

const UNDO_DAYS = 30;
const MAX_REPORT_ROWS = 600;

export type BatchUser = { id: string; name: string };

export type { Analysis, BatchSummary, StoredMapping } from "./wire";
import type { Analysis, BatchSummary, StoredMapping } from "./wire";

export async function createBatch(a: { kind: ImportKind; filename: string; buffer: Buffer; branchId: string; userId: string; options?: Record<string, unknown> }) {
  return prisma.importBatch.create({
    data: { kind: a.kind, filename: a.filename, fileData: new Uint8Array(a.buffer), branchId: a.branchId, createdById: a.userId, options: a.options ? JSON.stringify(a.options) : null },
    select: { id: true },
  });
}

export async function analyzeBatch(batchId: string, mapping?: StoredMapping): Promise<Analysis> {
  const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  const buffer = Buffer.from(batch.fileData ?? []);
  const kind = batch.kind as ImportKind;
  if (kind === "TIMESHEETS") {
    return { kind, sheets: await describeTimesheetWorkbook(buffer, mapping?.timesheetOverrides) };
  }
  const fields = TARGETS[kind].fields;
  const wb = await loadWorkbook(buffer, batch.filename);
  const sheets = await describeSheets(wb, fields);
  // The sheet with the most data is the likely one, unless one was picked.
  const chosen = sheets.find((s) => s.name === mapping?.sheet) ?? [...sheets].sort((x, y) => y.dataRows - x.dataRows)[0];
  const { columns, matches } = suggestMapping(chosen?.headers ?? [], fields);
  return { kind, sheets, sheet: chosen?.name ?? "", headerRow: chosen?.headerRow ?? 1, columns, matches };
}

async function apply(kind: ImportKind, ctx: ApplyCtx, batch: { fileData: Uint8Array | null; filename: string }, mapping: StoredMapping): Promise<ApplyResult> {
  const buffer = Buffer.from(batch.fileData ?? []);
  if (kind === "TIMESHEETS") return applyTimesheets(ctx, { buffer, filename: batch.filename }, mapping.timesheetOverrides ?? {}, mapping.aliases ?? {}, mapping.fixes ?? [], mapping.supplierDecisions ?? {});
  const fields = TARGETS[kind].fields;
  const wb = await loadWorkbook(buffer, batch.filename);
  const rows = extractRows(wb, mapping, fields);
  if (kind === "SUPPLIERS") return applySuppliers(ctx, rows);
  if (kind === "CLIENTS") return applyClients(ctx, rows);
  if (kind === "CAMPS") return applyCamps(ctx, rows, mapping.workerDecisions ?? {}, mapping.campOptions ?? {});
  if (kind === "VEHICLES") return applyVehicles(ctx, rows);
  return applyWorkers(ctx, rows, mapping.fixes ?? [], mapping.supplierDecisions ?? {});
}

function summarise(res: ApplyResult): BatchSummary {
  // Plain successes are in the counts; the report lists what needs attention.
  const interesting = res.rows.filter((r) => r.status === "error" || (r.notes && r.notes.length > 0));
  const kept = [...interesting].slice(0, MAX_REPORT_ROWS);
  return { counts: res.counts, notes: res.notes, rows: kept, totalRows: res.rows.length, truncated: interesting.length > kept.length, fixables: res.fixables, newSuppliers: res.newSuppliers, existingSuppliers: res.existingSuppliers, existingClients: res.existingClients, placementIssues: res.placementIssues, placements: res.placements?.slice(0, 400) };
}

class DryRun extends Error {
  constructor(public result: ApplyResult) { super("dry run"); }
}

/** Run the real import inside a transaction that is always rolled back: the
 * numbers and messages are exactly what a real run would produce. */
export async function previewBatch(batchId: string, user: BatchUser, mapping: StoredMapping): Promise<BatchSummary> {
  const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  if (batch.status === "RUNNING" || batch.status === "DONE" || batch.status === "UNDONE") throw new Error("This import has already been run.");
  const kind = batch.kind as ImportKind;
  let result: ApplyResult;
  try {
    await prisma.$transaction(
      async (tx) => {
        const ctx: ApplyCtx = { db: tx as Db, branchId: batch.branchId, user, audit: false };
        throw new DryRun(await apply(kind, ctx, batch, mapping));
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    throw new Error("unreachable");
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
    result = e.result;
  }
  // Names that couldn't be matched exactly get the assistant's opinion (outside the dry-run transaction).
  if (kind === "CAMPS" && result.placementIssues?.length) result.placementIssues = await suggestWorkerMatches(result.placementIssues);
  const summary = summarise(result);
  await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: "PREVIEWED", mapping: JSON.stringify(mapping), summary: JSON.stringify(summary), progressTotal: 0, progressDone: 0, error: null },
  });
  return summary;
}

/** Run for real, recording every change. Progress is written as it goes so the screen can show it. */
export async function runBatch(batchId: string, user: BatchUser, opts: { claimed?: boolean } = {}): Promise<void> {
  const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  // "claimed": the API already moved it PREVIEWED -> RUNNING in one atomic step, which is what stops a double click starting two runs.
  const runnable = batch.status === "PREVIEWED" || batch.status === "FAILED" || (opts.claimed && batch.status === "RUNNING");
  if (!runnable) return;
  const mapping = JSON.parse(batch.mapping ?? "{}") as StoredMapping;
  await prisma.importBatch.update({ where: { id: batchId }, data: { status: "RUNNING", progressDone: 0, progressTotal: 0, error: null } });
  await prisma.importChange.deleteMany({ where: { batchId } });

  let last = 0;
  const ctx: ApplyCtx = {
    db: trackedClient(batchId) as unknown as Db,
    branchId: batch.branchId,
    user,
    audit: true,
    progress: async (done, total) => {
      const now = Date.now();
      if (done < total && now - last < 700) return;
      last = now;
      await prisma.importBatch.update({ where: { id: batchId }, data: { progressDone: done, progressTotal: total } });
    },
  };
  try {
    const res = await apply(batch.kind as ImportKind, ctx, batch, mapping);
    const finished = new Date();
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "DONE",
        summary: JSON.stringify(summarise(res)),
        finishedAt: finished,
        undoUntil: new Date(finished.getTime() + UNDO_DAYS * 86_400_000),
        fileData: null, // the file is kept on the Upload for timesheets; nothing else needs it now
      },
    });
    await emitWebhookEvent(batch.branchId, "import.completed", { batch_id: batchId, kind: batch.kind, status: "DONE", counts: res.counts });
  } catch (e) {
    // Whatever was written before the failure is recorded, so it can be undone.
    await prisma.importBatch.update({
      where: { id: batchId },
      data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 500) : "Import failed", finishedAt: new Date(), undoUntil: new Date(Date.now() + UNDO_DAYS * 86_400_000) },
    });
    await emitWebhookEvent(batch.branchId, "import.completed", { batch_id: batchId, kind: batch.kind, status: "FAILED" });
  }
}

export async function undoBatch(batchId: string) {
  const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  if (batch.status !== "DONE" && batch.status !== "FAILED") throw new Error("Only a finished import can be undone.");
  if (batch.undoUntil && batch.undoUntil < new Date()) throw new Error("The undo window for this import has passed.");
  const outcome = await undoChanges(batchId);
  const summary = batch.summary ? (JSON.parse(batch.summary) as BatchSummary) : ({ counts: {}, notes: [], rows: [], totalRows: 0, truncated: false } as BatchSummary);
  summary.undo = { restored: outcome.restored, removed: outcome.removed, kept: outcome.kept.length };
  if (outcome.kept.length > 0) {
    summary.notes = [
      ...summary.notes,
      { tone: "warn", title: `${outcome.kept.length} records were kept`, detail: "They are used by other records now (for example attendance marked since). " + outcome.kept.slice(0, 3).map((k) => `${k.model}: ${k.reason}`).join("; ") },
    ];
  }
  await prisma.importBatch.update({ where: { id: batchId }, data: { status: "UNDONE", undoneAt: new Date(), summary: JSON.stringify(summary) } });
  return outcome;
}
