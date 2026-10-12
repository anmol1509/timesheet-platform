import type { ApplyCtx, ApplyResult, ImportNote, MappedRow, RowReport } from "../types";
import { auditor, clean, parseLooseDate } from "./shared";

const STATUSES = ["ACTIVE", "MAINTENANCE", "INACTIVE"];
const plateKey = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "");

function statusOf(raw: string): string | null {
  const t = clean(raw).toUpperCase();
  if (!t) return "";
  if (STATUSES.includes(t)) return t;
  if (/^(WORKSHOP|REPAIR|SERVICE|MAINT)/.test(t)) return "MAINTENANCE";
  if (/^(INACTIVE|OFF|SOLD|RETIRED|DISABLED)/.test(t)) return "INACTIVE";
  if (/^(ACT|IN USE|RUNNING|ON)/.test(t)) return "ACTIVE";
  return null;
}

/** Import vehicles (and their drivers). Matched by plate number ignoring spaces and dashes;
 * a blank cell never clears a saved value. */
export async function applyVehicles(ctx: ApplyCtx, input: MappedRow[]): Promise<ApplyResult> {
  const { db, branchId } = ctx;
  const audit = auditor(ctx);
  const rows: RowReport[] = [];
  const counts = { created: 0, updated: 0, merged: 0, failed: 0 };

  const existing = await db.vehicle.findMany({ where: { branchId } });
  const byPlate = new Map(existing.map((v) => [plateKey(v.plateNumber), v]));
  const seen = new Map<string, number>();
  let done = 0;

  for (const { row, values } of input) {
    const notes: ImportNote[] = [];
    const plate = clean(values.plateNumber);
    try {
      if (!plate) { rows.push({ row, status: "error", message: "Plate number is required." }); counts.failed++; continue; }
      const key = plateKey(plate);
      if (seen.has(key)) { rows.push({ row, name: plate, status: "skipped", message: `Same vehicle as row ${seen.get(key)}; ignored.` }); counts.merged++; continue; }
      seen.set(key, row);

      const data: Record<string, unknown> = {};
      const type = clean(values.type); if (type) data.type = type;
      const driverName = clean(values.driverName); if (driverName) data.driverName = driverName;
      const driverPhone = clean(values.driverPhone); if (driverPhone) data.driverPhone = driverPhone;
      const notesText = clean(values.notes); if (notesText) data.notes = notesText;
      const rawCap = clean(values.capacity);
      if (rawCap) {
        const cap = Number(rawCap);
        if (Number.isInteger(cap) && cap > 0 && cap < 1000) data.capacity = cap;
        else notes.push({ tone: "warn", title: `Capacity "${rawCap}" ignored`, detail: "It must be a whole number of seats." });
      }
      const status = statusOf(values.status ?? "");
      if (status === null) notes.push({ tone: "warn", title: `Status "${clean(values.status)}" ignored`, detail: "Use Active, Maintenance or Inactive." });
      else if (status) data.status = status;
      for (const [field, label] of [["registrationExpiry", "Registration expiry"], ["insuranceExpiry", "Insurance expiry"]] as const) {
        const raw = clean(values[field]);
        if (!raw) continue;
        const d = parseLooseDate(raw);
        if (d === "invalid" || d === null) notes.push({ tone: "warn", title: `${label} "${raw}" ignored`, detail: "Write the date as day/month/year." });
        else data[field] = d;
      }

      const current = byPlate.get(key);
      if (current) {
        if (Object.keys(data).length > 0) {
          const before = { ...current } as unknown as Record<string, unknown>;
          await db.vehicle.update({ where: { id: current.id }, data });
          Object.assign(current, data);
          await audit({ entityType: "VEHICLE", entityId: current.id, action: "UPDATE", before, after: data, userId: ctx.user.id, userName: ctx.user.name, branchId });
        }
        rows.push({ row, name: plate, status: "updated", notes });
        counts.updated++;
      } else {
        const create = { plateNumber: plate.toUpperCase(), ...data, branchId };
        const created = await db.vehicle.create({ data: create });
        byPlate.set(key, created);
        await audit({ entityType: "VEHICLE", entityId: created.id, action: "CREATE", after: create, userId: ctx.user.id, userName: ctx.user.name, branchId });
        rows.push({ row, name: plate, status: "created", notes });
        counts.created++;
      }
    } catch (e) {
      rows.push({ row, name: plate || undefined, status: "error", message: e instanceof Error ? e.message : "Failed to import row." });
      counts.failed++;
    }
    await ctx.progress?.(++done, input.length);
  }
  return { rows, counts, notes: [] };
}
