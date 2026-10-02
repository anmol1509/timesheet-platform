import { randomUUID } from "node:crypto";
import { nameKey } from "@/lib/partyCode";
import { singleLabel } from "@/lib/bunk";
import type { ApplyCtx, ApplyResult, ImportNote, MappedRow, RowReport } from "../types";
import { auditor, clean } from "./shared";

const MAX_BEDS = 500;

function campTypeOf(raw: string): "OWN" | "SUPPLIER" | "CLIENT" | "" | null {
  const t = clean(raw).toLowerCase();
  if (!t) return "";
  if (/^(own|owned|company|our|self|in-?house)/.test(t)) return "OWN";
  if (/^supplier|^vendor|^agency/.test(t)) return "SUPPLIER";
  if (/^client|^customer/.test(t)) return "CLIENT";
  return null;
}

/** Import camps, their rooms and (optionally) beds. Rows with only a camp name create an empty camp;
 * a room row adds the room, and a bed count adds numbered beds. Re-uploading never removes a bed or room. */
export async function applyCamps(ctx: ApplyCtx, input: MappedRow[]): Promise<ApplyResult> {
  const { db, branchId } = ctx;
  const audit = auditor(ctx);
  const rows: RowReport[] = [];
  const counts = { created: 0, updated: 0, roomsCreated: 0, bedsCreated: 0, workersPlaced: 0, notPlaced: 0, merged: 0, failed: 0 };

  const [camps, suppliers, clients] = await Promise.all([
    db.camp.findMany({ where: { branchId }, include: { rooms: { include: { beds: { select: { label: true } } } } } }),
    db.supplier.findMany({ where: { branchId }, select: { id: true, name: true } }),
    db.client.findMany({ where: { branchId }, select: { id: true, name: true } }),
  ]);
  const campByKey = new Map(camps.map((c) => [nameKey(c.name), c]));
  const supplierByKey = new Map(suppliers.map((s) => [nameKey(s.name), s.id]));
  const clientByKey = new Map(clients.map((c) => [nameKey(c.name), c.id]));

  type Spec = { row: number; room: string; beds: number | null; roomType: string; nationality: string; employee: string; code: string; bed: string };
  type Group = { name: string; firstRow: number; type: string; owner: string; specs: Spec[] };
  const groups = new Map<string, Group>();
  for (const { row, values } of input) {
    const name = clean(values.camp);
    if (!name) { rows.push({ row, status: "error", message: "Camp name is required." }); counts.failed++; continue; }
    const type = campTypeOf(values.campType ?? "");
    if (type === null) { rows.push({ row, name, status: "error", message: `Camp type "${clean(values.campType)}" isn't Own, Supplier or Client.` }); counts.failed++; continue; }
    const rawBeds = clean(values.beds);
    const beds = rawBeds ? Number(rawBeds) : null;
    if (beds !== null && (!Number.isInteger(beds) || beds < 0 || beds > MAX_BEDS)) {
      rows.push({ row, name, status: "error", message: `Number of beds "${rawBeds}" must be a whole number from 0 to ${MAX_BEDS}.` }); counts.failed++; continue;
    }
    const key = nameKey(name);
    const g = groups.get(key) ?? { name, firstRow: row, type: "", owner: "", specs: [] };
    if (type && !g.type) g.type = type;
    if (clean(values.owner) && !g.owner) g.owner = clean(values.owner);
    const room = clean(values.room);
    if (room) g.specs.push({ row, room, beds, roomType: clean(values.roomType), nationality: clean(values.nationality), employee: clean(values.employee), code: clean(values.employeeCode), bed: clean(values.bed) });
    else if (clean(values.employee) || clean(values.employeeCode)) { rows.push({ row, name, status: "error", message: `${clean(values.employee) || clean(values.employeeCode)}: add the room to place a worker.` }); counts.failed++; continue; }
    else if (groups.has(key)) { rows.push({ row, name, status: "skipped", message: `Same camp as row ${g.firstRow}; merged.` }); counts.merged++; }
    groups.set(key, g);
  }

  // Workers named in the file: found by employee code when given, otherwise by name.
  const wantsPeople = input.some((r) => clean(r.values.employee) || clean(r.values.employeeCode));
  const roster = wantsPeople ? await db.employee.findMany({ where: { branchId }, select: { id: true, name: true, employeeIdNo: true, bed: { select: { id: true, label: true, room: { select: { name: true, camp: { select: { name: true } } } } } } } }) : [];
  const byCode = new Map(roster.map((p) => [p.employeeIdNo.toLowerCase(), p]));
  const byName = new Map<string, typeof roster>();
  for (const p of roster) byName.set(nameKey(p.name), [...(byName.get(nameKey(p.name)) ?? []), p]);
  const placedNow = new Set<string>();

  /** Puts a worker in a bed of the camp's room: the bed named in the file, else the first free one.
   * Returns why they weren't placed, or null once they are. */
  async function placeWorker(spec: { room: string; employee: string; code: string; bed: string }, camp: { id: string; name: string; ownerType: string; rooms: { id: string; name: string }[] }): Promise<string | null> {
    if (camp.ownerType !== "OWN") return "Only your own camps have beds; supplier and client camps are recorded at check-in.";
    let person: (typeof roster)[number] | undefined;
    if (spec.code) {
      person = byCode.get(spec.code.toLowerCase());
      if (!person) return `No worker with the employee code ${spec.code} is on record.`;
    } else {
      const matches = byName.get(nameKey(spec.employee)) ?? [];
      if (matches.length === 0) return "No worker with that name is on record. Check the spelling, or use the employee code.";
      if (matches.length > 1) return `${matches.length} workers are named ${spec.employee}. Add the employee code to say which one.`;
      person = matches[0];
    }
    if (placedNow.has(person.id)) return "Already placed earlier in this file.";
    if (person.bed) return `Already in ${person.bed.room.camp.name} / ${person.bed.room.name} / ${person.bed.label}. Move them from the Camps page.`;
    const room = camp.rooms.find((r) => nameKey(r.name) === nameKey(spec.room));
    if (!room) return "The room wasn't found.";
    const beds = await db.bed.findMany({ where: { roomId: room.id }, orderBy: { label: "asc" } });
    let bed = null as (typeof beds)[number] | null;
    if (spec.bed) {
      const want = spec.bed.toLowerCase().replace(/\s+/g, "");
      const padded = /^\d+$/.test(want) ? singleLabel(Number(want)).toLowerCase().replace(/\s+/g, "") : want;
      bed = beds.find((b) => { const l = b.label.toLowerCase().replace(/\s+/g, ""); return l === want || l === padded; }) ?? null;
      if (!bed) return `Bed "${spec.bed}" doesn't exist in room ${spec.room}.`;
      if (bed.employeeId) return `Bed "${bed.label}" is already taken.`;
    } else {
      bed = beds.find((b) => !b.employeeId) ?? null;
      if (!bed) return beds.length === 0 ? `Room ${spec.room} has no beds. Add a Number of beds.` : `Room ${spec.room} is full.`;
    }
    await db.bed.update({ where: { id: bed.id }, data: { employeeId: person.id } });
    await db.accommodationHistory.create({ data: { employeeId: person.id, campName: camp.name, roomName: room.name, bedLabel: bed.label } });
    const open = await db.campCheckIn.findFirst({ where: { employeeId: person.id, status: { in: ["CHECKED_IN", "BED_ALLOCATED"] } }, orderBy: { createdAt: "desc" } });
    if (open) await db.campCheckIn.update({ where: { id: open.id }, data: { campId: camp.id, bedId: bed.id, status: "BED_ALLOCATED" } });
    else await db.campCheckIn.create({ data: { employeeId: person.id, campId: camp.id, bedId: bed.id, status: "BED_ALLOCATED", branchId } });
    await audit({ entityType: "ACCOMMODATION", entityId: bed.id, action: "UPDATE", after: { employeeId: person.id, campName: camp.name, roomName: room.name, bedLabel: bed.label }, userId: ctx.user.id, userName: ctx.user.name, branchId });
    placedNow.add(person.id);
    return null;
  }

  let done = 0;
  const order = [...groups.entries()];
  for (const [key, g] of order) {
    const notes: ImportNote[] = [];
    try {
      // Who provides the camp: the type if given, otherwise inferred from the owner's name.
      let type = g.type || "";
      let supplierId: string | null = null;
      let clientId: string | null = null;
      if (g.owner) {
        const s = supplierByKey.get(nameKey(g.owner));
        const c = clientByKey.get(nameKey(g.owner));
        if (!type) type = s ? "SUPPLIER" : c ? "CLIENT" : "OWN";
        if (type === "SUPPLIER") { supplierId = s ?? null; if (!s) notes.push({ tone: "warn", title: `Supplier "${g.owner}" isn't on record`, detail: "The camp was marked as a supplier camp without naming one." }); }
        else if (type === "CLIENT") { clientId = c ?? null; if (!c) notes.push({ tone: "warn", title: `Client "${g.owner}" isn't on record`, detail: "The camp was marked as a client camp without naming one." }); }
      }
      type = type || "OWN";

      let camp = campByKey.get(key);
      let isNew = false;
      if (!camp) {
        const created = await db.camp.create({ data: { name: g.name, ownerType: type, owningSupplierId: supplierId, owningClientId: clientId, branchId }, include: { rooms: { include: { beds: { select: { label: true } } } } } });
        camp = created;
        campByKey.set(key, camp);
        isNew = true;
        counts.created++;
        await audit({ entityType: "CAMP", entityId: created.id, action: "CREATE", after: { name: g.name, ownerType: type, owningSupplierId: supplierId, owningClientId: clientId }, userId: ctx.user.id, userName: ctx.user.name, branchId });
      } else if (g.type || g.owner) {
        await db.camp.update({ where: { id: camp.id }, data: { ownerType: type, owningSupplierId: supplierId, owningClientId: clientId } });
      }

      let touched = isNew;
      for (const spec of g.specs) {
        const roomKey = nameKey(spec.room);
        let room = camp.rooms.find((r) => nameKey(r.name) === roomKey);
        if (!room) {
          const createdRoom = await db.room.create({
            data: { campId: camp.id, name: spec.room, bedSpace: spec.beds, usableBedSpace: spec.beds, roomType: spec.roomType || null, nationality: spec.nationality || null },
          });
          room = { ...createdRoom, beds: [] };
          camp.rooms.push(room);
          counts.roomsCreated++;
          touched = true;
        } else {
          const data: Record<string, unknown> = {};
          if (spec.roomType) data.roomType = spec.roomType;
          if (spec.nationality) data.nationality = spec.nationality;
          if (spec.beds !== null) { data.bedSpace = spec.beds; data.usableBedSpace = spec.beds; }
          if (Object.keys(data).length) { await db.room.update({ where: { id: room.id }, data }); touched = true; }
        }
        if (spec.beds && spec.beds > 0) {
          const have = new Set(room.beds.map((b) => b.label));
          const toAdd: { id: string; roomId: string; label: string }[] = [];
          // Fill to the requested count with Bed 01, Bed 02…, skipping labels already used.
          for (let i = 1; room.beds.length + toAdd.length < spec.beds && i <= MAX_BEDS * 2; i++) {
            const label = singleLabel(i);
            if (!have.has(label)) { toAdd.push({ id: randomUUID(), roomId: room.id, label }); have.add(label); }
          }
          if (toAdd.length) {
            await db.bed.createMany({ data: toAdd });
            room.beds.push(...toAdd.map((b) => ({ label: b.label })));
            counts.bedsCreated += toAdd.length;
            touched = true;
          }
          if (room.beds.length > spec.beds) notes.push({ tone: "info", title: `${spec.room} already has ${room.beds.length} beds`, detail: `More than the ${spec.beds} in the file; none were removed.` });
        }
      }
      // Placing workers comes after every room and bed in the file exists, so row order doesn't matter.
      for (const spec of g.specs) {
        if (!spec.employee && !spec.code) continue;
        const problem = await placeWorker(spec, camp);
        if (problem) { notes.push({ tone: "warn", title: `${spec.employee || spec.code} (row ${spec.row}) not placed`, detail: problem }); counts.notPlaced++; }
        else { counts.workersPlaced++; touched = true; }
      }
      if (!isNew && touched) { counts.updated++; }
      rows.push({ row: g.firstRow, name: g.name, status: isNew ? "created" : touched ? "updated" : "skipped", message: !isNew && !touched ? "Nothing new." : undefined, notes });
    } catch (e) {
      rows.push({ row: g.firstRow, name: g.name, status: "error", message: e instanceof Error ? e.message : "Failed to import camp." });
      counts.failed++;
    }
    await ctx.progress?.(++done, order.length);
  }
  rows.sort((a, b) => a.row - b.row);
  return { rows, counts, notes: [] };
}
