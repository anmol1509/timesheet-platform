import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

// Every record an import creates or changes is written to ImportChange as it
// happens, so a whole import can be undone. It is a client extension, so the
// import code itself doesn't have to remember to record anything.

/** Models the importers write to. A write to one of these is recorded. */
export const TRACKED_MODELS = new Set(["Supplier", "Client", "Employee", "TimesheetEntry", "Upload", "UploadMonth", "Attendance", "Camp", "Room", "Bed", "Vehicle", "CampCheckIn", "AccommodationHistory"]);

const delegate = (model: string) => (prisma as unknown as Record<string, any>)[model[0].toLowerCase() + model.slice(1)]; // eslint-disable-line @typescript-eslint/no-explicit-any

export function encodeValues(values: Record<string, unknown>): string {
  return JSON.stringify(values, (_k, v) => {
    if (v instanceof Date) return { $d: v.toISOString() };
    if (v instanceof Prisma.Decimal) return { $n: v.toString() };
    return v;
  });
}

export function decodeValues(json: string): Record<string, unknown> {
  return JSON.parse(json, (_k, v) => {
    if (v && typeof v === "object" && "$d" in v) return new Date(v.$d);
    if (v && typeof v === "object" && "$n" in v) return new Prisma.Decimal(v.$n);
    return v;
  });
}

/** Only real columns count: relation inputs in `data` aren't in the stored row. */
function previousValues(before: Record<string, unknown>, data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(data)) if (k in before) out[k] = before[k];
  return out;
}

export function trackedClient(batchId: string) {
  let seq = 0;
  const log = (model: string, recordId: string, action: "CREATE" | "UPDATE", before: Record<string, unknown> | null) =>
    prisma.importChange.create({
      data: { batchId, seq: seq++, model, recordId, action, before: before ? encodeValues(before) : null },
    });

  const refuse = (model: string, op: string) => {
    throw new Error(`Import code used ${model}.${op}, which can't be undone. Use create/update/upsert.`);
  };

  return prisma.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const res = await query(args);
          if (TRACKED_MODELS.has(model)) await log(model, (res as { id: string }).id, "CREATE", null);
          return res;
        },
        async update({ model, args, query }) {
          if (!TRACKED_MODELS.has(model)) return query(args);
          const prev = await delegate(model).findUnique({ where: args.where });
          const res = await query(args);
          if (prev) await log(model, prev.id, "UPDATE", previousValues(prev, args.data as Record<string, unknown>));
          return res;
        },
        async upsert({ model, args, query }) {
          if (!TRACKED_MODELS.has(model)) return query(args);
          const prev = await delegate(model).findUnique({ where: args.where });
          const res = await query(args);
          if (prev) await log(model, prev.id, "UPDATE", previousValues(prev, args.update as Record<string, unknown>));
          else await log(model, (res as { id: string }).id, "CREATE", null);
          return res;
        },
        // Bulk inserts are fine as long as every row carries its own id, which
        // is what lets each one be recorded (and removed on undo).
        async createMany({ model, args, query }) {
          if (!TRACKED_MODELS.has(model)) return query(args);
          const data = (Array.isArray(args.data) ? args.data : [args.data]) as { id?: string }[];
          if (data.some((d) => !d.id)) refuse(model, "createMany without ids");
          // skipDuplicates could silently skip a row that is then "recorded"; a dry run and undo rely on exactness.
          const res = await query({ ...args, skipDuplicates: false });
          await prisma.importChange.createMany({
            data: data.map((d) => ({ batchId, seq: seq++, model, recordId: d.id as string, action: "CREATE" })),
          });
          return res;
        },
        async updateMany({ model, args, query }) {
          if (TRACKED_MODELS.has(model)) refuse(model, "updateMany");
          return query(args);
        },
        async delete({ model, args, query }) {
          if (TRACKED_MODELS.has(model)) refuse(model, "delete");
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (TRACKED_MODELS.has(model)) refuse(model, "deleteMany");
          return query(args);
        },
      },
    },
  });
}

export type UndoOutcome = { restored: number; removed: number; kept: { model: string; recordId: string; reason: string }[] };

// Children first, so a parent is never deleted while something in the same
// import still points at it.
const DELETE_ORDER = ["Attendance", "TimesheetEntry", "UploadMonth", "Upload", "Employee", "CampCheckIn", "AccommodationHistory", "Bed", "Room", "Camp", "Vehicle", "Client", "Supplier"];
const CHUNK = 500;

/** Reverse a batch. Changed records get their old values back and created ones
 * are removed. Deleting is done in bulk, children before parents. A created
 * record that something else now points at (say a worker who has since been
 * given attendance) is kept, and reported. Safe to run again if interrupted:
 * whatever is already gone is skipped. */
export async function undoChanges(batchId: string): Promise<UndoOutcome> {
  const changes = await prisma.importChange.findMany({ where: { batchId }, orderBy: { seq: "desc" } });
  const out: UndoOutcome = { restored: 0, removed: 0, kept: [] };
  const created = new Set(changes.filter((c) => c.action === "CREATE").map((c) => `${c.model}:${c.recordId}`));

  // 1. Put changed records back (newest first, so the oldest values win).
  //    A record this import also created is about to be deleted; skip it.
  for (const c of changes) {
    if (c.action !== "UPDATE" || !c.before || created.has(`${c.model}:${c.recordId}`)) continue;
    try {
      await delegate(c.model).update({ where: { id: c.recordId }, data: decodeValues(c.before) });
      out.restored++;
    } catch (e) {
      if ((e as { code?: string }).code !== "P2025") {
        out.kept.push({ model: c.model, recordId: c.recordId, reason: e instanceof Error ? e.message.slice(0, 120) : "could not be restored" });
      }
    }
  }

  // 2. Remove what was created, model by model, in chunks.
  const byModel = new Map<string, string[]>();
  for (const c of changes) if (c.action === "CREATE") byModel.set(c.model, [...(byModel.get(c.model) ?? []), c.recordId]);
  const models = [...DELETE_ORDER.filter((m) => byModel.has(m)), ...[...byModel.keys()].filter((m) => !DELETE_ORDER.includes(m))];
  for (const model of models) {
    const d = delegate(model);
    const ids = byModel.get(model)!;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      try {
        out.removed += (await d.deleteMany({ where: { id: { in: chunk } } })).count;
      } catch {
        // Something in the chunk is still in use: find out which, one by one.
        for (const id of chunk) {
          try {
            await d.delete({ where: { id } });
            out.removed++;
          } catch (e) {
            const code = (e as { code?: string }).code;
            if (code === "P2025") continue;
            out.kept.push({ model, recordId: id, reason: code === "P2003" ? "still used by other records" : e instanceof Error ? e.message.slice(0, 120) : "could not be removed" });
          }
        }
      }
    }
  }
  return out;
}
