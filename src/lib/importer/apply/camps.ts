import { randomUUID } from "node:crypto";
import { nameKey } from "@/lib/partyCode";
import { bedPreference, bunkLabel, labelOfBed, parseBedInput, parseBerth, singleLabel } from "@/lib/bunk";
import { exactKey, rankCandidates } from "../workerMatch";
import type { ApplyCtx, ApplyResult, ImportNote, MappedRow, PlacementIssue, PlacementRow, RowReport, WorkerChoice } from "../types";
import { auditor, clean } from "./shared";

const MAX_BEDS = 100; // per kind, per room

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
export async function applyCamps(ctx: ApplyCtx, input: MappedRow[], decisions: Record<string, WorkerChoice> = {}): Promise<ApplyResult> {
  const { db, branchId } = ctx;
  const audit = auditor(ctx);
  const rows: RowReport[] = [];
  const counts = { created: 0, updated: 0, roomsCreated: 0, bedsCreated: 0, bunksAdded: 0, workersPlaced: 0, notPlaced: 0, needDecision: 0, merged: 0, failed: 0 };

  const [camps, suppliers, clients] = await Promise.all([
    db.camp.findMany({ where: { branchId }, include: { rooms: { include: { beds: { select: { label: true } } } } } }),
    db.supplier.findMany({ where: { branchId }, select: { id: true, name: true } }),
    db.client.findMany({ where: { branchId }, select: { id: true, name: true } }),
  ]);
  const campByKey = new Map(camps.map((c) => [nameKey(c.name), c]));
  const supplierByKey = new Map(suppliers.map((s) => [nameKey(s.name), s.id]));
  const clientByKey = new Map(clients.map((c) => [nameKey(c.name), c.id]));

  type Spec = { row: number; room: string; singles: number | null; bunks: number | null; roomType: string; nationality: string; employee: string; code: string; bed: string };
  type Group = { name: string; firstRow: number; type: string; owner: string; specs: Spec[] };
  const groups = new Map<string, Group>();
  for (const { row, values } of input) {
    const name = clean(values.camp);
    if (!name) { rows.push({ row, status: "error", message: "Camp name is required." }); counts.failed++; continue; }
    const type = campTypeOf(values.campType ?? "");
    if (type === null) { rows.push({ row, name, status: "error", message: `Camp type "${clean(values.campType)}" isn't Own, Supplier or Client.` }); counts.failed++; continue; }
    const countOf = (raw: string, what: string): number | null | "bad" => {
      const t = clean(raw);
      if (!t) return null;
      const n = Number(t);
      if (!Number.isInteger(n) || n < 0 || n > MAX_BEDS) { rows.push({ row, name, status: "error", message: `${what} "${t}" must be a whole number from 0 to ${MAX_BEDS}.` }); counts.failed++; return "bad"; }
      return n;
    };
    const singles = countOf(values.singles ?? "", "Single beds");
    if (singles === "bad") continue;
    const bunks = countOf(values.bunks ?? "", "Bunks");
    if (bunks === "bad") continue;
    const key = nameKey(name);
    const g = groups.get(key) ?? { name, firstRow: row, type: "", owner: "", specs: [] };
    if (type && !g.type) g.type = type;
    if (clean(values.owner) && !g.owner) g.owner = clean(values.owner);
    const room = clean(values.room);
    if (room) g.specs.push({ row, room, singles, bunks, roomType: clean(values.roomType), nationality: clean(values.nationality), employee: clean(values.employee), code: clean(values.employeeCode), bed: clean(values.bed) });
    else if (clean(values.employee) || clean(values.employeeCode)) { rows.push({ row, name, status: "error", message: `${clean(values.employee) || clean(values.employeeCode)}: add the room to place a worker.` }); counts.failed++; continue; }
    else if (groups.has(key)) { rows.push({ row, name, status: "skipped", message: `Same camp as row ${g.firstRow}; merged.` }); counts.merged++; }
    groups.set(key, g);
  }

  // Workers named in the file: found by employee code when given, otherwise by name.
  const wantsPeople = input.some((r) => clean(r.values.employee) || clean(r.values.employeeCode));
  const roster = wantsPeople
    ? await db.employee.findMany({
        where: { branchId },
        select: { id: true, name: true, employeeIdNo: true, trade: true, supplier: { select: { name: true } }, bed: { select: { id: true, label: true, room: { select: { name: true, camp: { select: { name: true } } } } } } },
      })
    : [];
  const byId = new Map(roster.map((p) => [p.id, p]));
  const byCode = new Map(roster.map((p) => [p.employeeIdNo.toLowerCase(), p]));
  const byName = new Map<string, typeof roster>();
  for (const p of roster) byName.set(exactKey(p.name), [...(byName.get(exactKey(p.name)) ?? []), p]);
  const placedNow = new Set<string>();
  const placements: PlacementRow[] = [];
  const issues = new Map<string, PlacementIssue>();
  const housedAt = (p: (typeof roster)[number]) => (p.bed ? `${p.bed.room.camp.name} / ${p.bed.room.name} / ${p.bed.label}` : null);
  const asCandidate = (p: (typeof roster)[number], score: number) => ({ id: p.id, name: p.name, code: p.employeeIdNo, trade: p.trade ?? null, supplier: p.supplier?.name ?? null, housed: housedAt(p), score: Math.round(score * 100) / 100 });
  const personShape = (p: (typeof roster)[number]) => ({ name: p.name, code: p.employeeIdNo, trade: p.trade ?? null });

  type Resolved = { person: (typeof roster)[number] } | { skip: string } | { issue: PlacementIssue["kind"]; candidates: PlacementIssue["candidates"] };
  /** Who the file means: a code, an exact name, a decision the person already made, or a question for them. */
  function resolve(spec: { employee: string; code: string }): Resolved {
    if (spec.code) {
      const p = byCode.get(spec.code.toLowerCase());
      return p ? { person: p } : { skip: `No worker with the employee code ${spec.code} is on record.` };
    }
    const decision = decisions[exactKey(spec.employee)];
    if (decision?.action === "skip") return { skip: "You chose to skip this worker." };
    if (decision?.action === "use") {
      const p = byId.get(decision.employeeId);
      return p ? { person: p } : { skip: "The worker you chose is no longer on record." };
    }
    const exact = byName.get(exactKey(spec.employee)) ?? [];
    if (exact.length === 1) return { person: exact[0] };
    if (exact.length > 1) return { issue: "several", candidates: exact.map((p) => asCandidate(p, 1)) };
    const close = rankCandidates(spec.employee, roster.map((p) => ({ id: p.id, name: p.name, employeeIdNo: p.employeeIdNo })));
    return { issue: close.length ? "close" : "unknown", candidates: close.map((p) => asCandidate(byId.get(p.id)!, p.score)) };
  }

  /** Puts a worker in a bed of the camp's room: the bed named in the file, else the first free one. */
  async function placeWorker(spec: { row: number; room: string; employee: string; code: string; bed: string }, camp: { id: string; name: string; ownerType: string; rooms: { id: string; name: string }[] }): Promise<string | null> {
    const label = spec.employee || spec.code;
    const row = { row: spec.row, fileName: label, camp: camp.name, room: spec.room };
    if (camp.ownerType !== "OWN") { placements.push({ ...row, worker: null, bed: null, status: "blocked", note: "Only your own camps have beds." }); return "Only your own camps have beds; supplier and client camps are recorded at check-in."; }
    const r = resolve(spec);
    if ("skip" in r) { placements.push({ ...row, worker: null, bed: null, status: "skipped", note: r.skip }); return r.skip; }
    if ("issue" in r) {
      const key = exactKey(spec.employee);
      const have = issues.get(key);
      if (have) have.rows.push(spec.row);
      else issues.set(key, { key, fileName: spec.employee, rows: [spec.row], camp: camp.name, room: spec.room, kind: r.issue, candidates: r.candidates });
      counts.needDecision++;
      placements.push({ ...row, worker: null, bed: null, status: "decide", note: r.issue === "several" ? "Several workers share this name." : r.issue === "close" ? "No exact match; close ones found." : "Not on record." });
      return null;
    }
    const person = r.person;
    if (placedNow.has(person.id)) { placements.push({ ...row, worker: personShape(person), bed: null, status: "skipped", note: "Already placed earlier in this file." }); return "Already placed earlier in this file."; }
    if (person.bed) { const at = housedAt(person); placements.push({ ...row, worker: personShape(person), bed: null, status: "skipped", note: `Already in ${at}.` }); return `Already in ${at}. Move them from the Camps page.`; }
    const room = camp.rooms.find((x) => nameKey(x.name) === nameKey(spec.room));
    if (!room) { placements.push({ ...row, worker: personShape(person), bed: null, status: "skipped", note: "Room not found." }); return "The room wasn't found."; }
    const beds = await db.bed.findMany({ where: { roomId: room.id }, orderBy: { label: "asc" } });
    let bed = null as (typeof beds)[number] | null;
    let problem: string | null = null;
    if (spec.bed) {
      const parsed = parseBedInput(spec.bed);
      const label = parsed ? labelOfBed(parsed) : null;
      bed = label ? beds.find((b) => b.label === label) ?? null : null;
      if (!parsed) problem = `Couldn't read the bed "${spec.bed}". Use Bed 03, or Bunk 02 Upper / Lower.`;
      else if (!bed) problem = `${label} doesn't exist in room ${spec.room}.`;
      else if (bed.employeeId) problem = `${bed.label} is already taken.`;
    } else {
      // Singles first, then lower berths, then upper berths.
      const order = [...beds].sort((x, y) => bedPreference(x.label) - bedPreference(y.label) || x.label.localeCompare(y.label, undefined, { numeric: true }));
      bed = order.find((b) => !b.employeeId) ?? null;
      if (!bed) problem = beds.length === 0 ? `Room ${spec.room} has no beds. Fill in Single beds or Bunks for it.` : `Room ${spec.room} is full.`;
    }
    if (problem || !bed) { placements.push({ ...row, worker: personShape(person), bed: null, status: "blocked", note: problem ?? "No bed." }); return problem; }
    await db.bed.update({ where: { id: bed.id }, data: { employeeId: person.id } });
    await db.accommodationHistory.create({ data: { employeeId: person.id, campName: camp.name, roomName: room.name, bedLabel: bed.label } });
    const open = await db.campCheckIn.findFirst({ where: { employeeId: person.id, status: { in: ["CHECKED_IN", "BED_ALLOCATED"] } }, orderBy: { createdAt: "desc" } });
    if (open) await db.campCheckIn.update({ where: { id: open.id }, data: { campId: camp.id, bedId: bed.id, status: "BED_ALLOCATED" } });
    else await db.campCheckIn.create({ data: { employeeId: person.id, campId: camp.id, bedId: bed.id, status: "BED_ALLOCATED", branchId } });
    await audit({ entityType: "ACCOMMODATION", entityId: bed.id, action: "UPDATE", after: { employeeId: person.id, campName: camp.name, roomName: room.name, bedLabel: bed.label }, userId: ctx.user.id, userName: ctx.user.name, branchId });
    placedNow.add(person.id);
    placements.push({ ...row, worker: personShape(person), bed: bed.label, status: "placed" });
    return null;
  }

  /** Beds a room should have per the file: singles plus two berths per bunk; null when the file says nothing. */
  const capacity = (x: { singles: number | null; bunks: number | null }) => (x.singles === null && x.bunks === null ? null : (x.singles ?? 0) + 2 * (x.bunks ?? 0));

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
            data: { campId: camp.id, name: spec.room, bedSpace: capacity(spec), usableBedSpace: capacity(spec), roomType: spec.roomType || null, nationality: spec.nationality || null },
          });
          room = { ...createdRoom, beds: [] };
          camp.rooms.push(room);
          counts.roomsCreated++;
          touched = true;
        } else {
          const data: Record<string, unknown> = {};
          if (spec.roomType) data.roomType = spec.roomType;
          if (spec.nationality) data.nationality = spec.nationality;
          if (capacity(spec) !== null) { data.bedSpace = capacity(spec); data.usableBedSpace = capacity(spec); }
          if (Object.keys(data).length) { await db.room.update({ where: { id: room.id }, data }); touched = true; }
        }
        // Top the room up to the counts in the file. Beds are only ever added, never removed.
        const have = new Set(room.beds.map((x) => x.label));
        const toAdd: { id: string; roomId: string; label: string }[] = [];
        const add = (label: string) => { if (!have.has(label)) { toAdd.push({ id: randomUUID(), roomId: room!.id, label }); have.add(label); } };
        if (spec.singles) {
          const existing = room.beds.filter((x) => !parseBerth(x.label)).length;
          for (let i = 1, need = spec.singles - existing; need > 0 && i <= MAX_BEDS * 2; i++) { const before = toAdd.length; add(singleLabel(i)); if (toAdd.length > before) need--; }
        }
        if (spec.bunks) for (let n = 1; n <= spec.bunks; n++) { add(bunkLabel(n, "Upper")); add(bunkLabel(n, "Lower")); }
        if (toAdd.length) {
          await db.bed.createMany({ data: toAdd });
          room.beds.push(...toAdd.map((x) => ({ label: x.label })));
          counts.bedsCreated += toAdd.length;
          counts.bunksAdded += toAdd.filter((x) => x.label.endsWith("Upper")).length;
          touched = true;
        }
        const wantTotal = capacity(spec);
        if (wantTotal !== null && room.beds.length > wantTotal) notes.push({ tone: "info", title: `${spec.room} already has ${room.beds.length} beds`, detail: `More than the ${wantTotal} in the file; none were removed.` });
      }
      // Placing workers comes after every room and bed in the file exists, so row order doesn't matter.
      for (const spec of g.specs) {
        if (!spec.employee && !spec.code) continue;
        const before = counts.needDecision;
        const problem = await placeWorker(spec, camp);
        if (problem) { notes.push({ tone: "warn", title: `${spec.employee || spec.code} (row ${spec.row}) not placed`, detail: problem }); counts.notPlaced++; }
        else if (counts.needDecision === before) { counts.workersPlaced++; touched = true; }
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
  placements.sort((x, y) => x.row - y.row);
  return { rows, counts, notes: [], placements, placementIssues: [...issues.values()] };
}
