import { randomUUID } from "node:crypto";
import { nameKey } from "@/lib/partyCode";
import { bedPreference, bunkLabel, labelOfBed, parseBedInput, parseBerth, singleLabel } from "@/lib/bunk";
import { exactKey, nameSimilarity, rankCandidates } from "../workerMatch";
import { readRosterDates } from "../rosterDates";
import { todayKey } from "@/lib/checkoutReasons";
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
export async function applyCamps(ctx: ApplyCtx, input: MappedRow[], decisions: Record<string, WorkerChoice> = {}, options: { campName?: string; autoBeds?: "bunks" | "singles" | "none" } = {}): Promise<ApplyResult> {
  const { db, branchId } = ctx;
  const audit = auditor(ctx);
  const rows: RowReport[] = [];
  const counts = { created: 0, updated: 0, roomsCreated: 0, bedsCreated: 0, bunksAdded: 0, workersPlaced: 0, workersCreated: 0, noCheckIn: 0, pastStays: 0, datesCorrected: 0, notPlaced: 0, needDecision: 0, merged: 0, failed: 0 };

  const [camps, suppliers, clients] = await Promise.all([
    db.camp.findMany({ where: { branchId }, include: { rooms: { include: { beds: { select: { label: true } } } } } }),
    db.supplier.findMany({ where: { branchId }, select: { id: true, name: true } }),
    db.client.findMany({ where: { branchId }, select: { id: true, name: true } }),
  ]);
  const campByKey = new Map(camps.map((c) => [nameKey(c.name), c]));
  const supplierByKey = new Map(suppliers.map((s) => [nameKey(s.name), s.id]));
  const clientByKey = new Map(clients.map((c) => [nameKey(c.name), c.id]));

  type Spec = { row: number; room: string; singles: number | null; bunks: number | null; roomType: string; nationality: string; employee: string; code: string; bed: string; trade: string; mobile: string; status: string; checkIn: string | null; checkOut: string | null };
  type Group = { name: string; firstRow: number; type: string; owner: string; specs: Spec[] };
  const groups = new Map<string, Group>();
  const notes0: ImportNote[] = [];

  // Check-in / check-out dates, read together so day/month mix-ups can be spotted across the whole column.
  const dateRaws: string[] = [];
  for (const { values } of input) { dateRaws.push(clean(values.checkIn)); dateRaws.push(clean(values.checkOut)); }
  const dateReads = readRosterDates(dateRaws);
  const dateOf = (rowIndex: number, which: 0 | 1) => dateReads[rowIndex * 2 + which];
  const fixed = dateReads.filter((d) => d.corrected);
  counts.datesCorrected = fixed.length;
  if (fixed.length) {
    notes0.push({ tone: "warn", title: `${fixed.length} date${fixed.length === 1 ? "" : "s"} looked day/month-swapped and ${fixed.length === 1 ? "was" : "were"} corrected`, detail: `Excel read some day-first dates the US way (for example 03/09 as 9 March). Compared with the other dates in the file, these were read the other way: ${fixed.slice(0, 8).map((d) => `${d.original} → ${d.iso}`).join(", ")}${fixed.length > 8 ? "…" : ""}. Check them against your file.` });
  }

  const futureCheckIns: string[] = [];
  let rowIndex = -1;
  for (const { row, values } of input) {
    rowIndex++;
    const name = clean(values.camp) || clean(options.campName);
    if (!name) { rows.push({ row, status: "error", message: "Camp name is required: add a Camp name column, or type the camp name before importing." }); counts.failed++; continue; }
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
    const rawRoom = clean(values.room);
    const room = /^check\s*-?\s*out$/i.test(rawRoom) ? "" : rawRoom;
    const inRead = dateOf(rowIndex, 0), outRead = dateOf(rowIndex, 1);
    for (const [label, d] of [["Check in", inRead], ["Check out", outRead]] as const) {
      if (d.invalid) notes0.push({ tone: "warn", title: `Row ${row}: ${label} "${d.original}" isn't a date`, detail: "It was ignored." });
    }
    let checkInIso = inRead.iso;
    if (checkInIso && checkInIso > todayKey()) { futureCheckIns.push(`row ${row}: ${checkInIso}`); checkInIso = null; }
    const spec: Spec = { row, room, singles, bunks, roomType: clean(values.roomType), nationality: clean(values.nationality), employee: clean(values.employee), code: clean(values.employeeCode), bed: clean(values.bed), trade: clean(values.trade), mobile: clean(values.mobile), status: clean(values.status), checkIn: checkInIso, checkOut: outRead.iso };
    const leaving = !!spec.checkOut && spec.checkOut <= todayKey();
    // A worker with a room is housed there; one who has already left can be recorded without a room.
    if (room || ((spec.employee || spec.code) && leaving)) g.specs.push(spec);
    else if (clean(values.employee) || clean(values.employeeCode)) { rows.push({ row, name, status: "error", message: `${clean(values.employee) || clean(values.employeeCode)}: add the room to place a worker.` }); counts.failed++; continue; }
    else if (groups.has(key)) { rows.push({ row, name, status: "skipped", message: `Same camp as row ${g.firstRow}; merged.` }); counts.merged++; }
    groups.set(key, g);
  }

  if (futureCheckIns.length) notes0.push({ tone: "warn", title: `${futureCheckIns.length} check-in date${futureCheckIns.length === 1 ? " is" : "s are"} in the future and ${futureCheckIns.length === 1 ? "was" : "were"} ignored`, detail: `Those workers are checked in today instead (${futureCheckIns.slice(0, 6).join(", ")}${futureCheckIns.length > 6 ? "…" : ""}). Correct the dates in your file if they matter.` });

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

  type Resolved = { person: (typeof roster)[number] } | { create: true } | { skip: string } | { issue: PlacementIssue["kind"]; candidates: PlacementIssue["candidates"] };
  /** Who the file means: a decision already made, a code, an exact name, or a question for the person. */
  function resolve(spec: { employee: string; code: string }): Resolved {
    const label = spec.employee || spec.code;
    const decision = decisions[exactKey(label)];
    if (decision?.action === "skip") return { skip: "You chose to skip this worker." };
    if (decision?.action === "create") return { create: true };
    if (decision?.action === "use") {
      const p = byId.get(decision.employeeId);
      return p ? { person: p } : { skip: "The worker you chose is no longer on record." };
    }
    if (spec.code) {
      const p = byCode.get(spec.code.toLowerCase());
      if (p) {
        // A code that belongs to someone with a very different name is probably a typo or a reused code.
        if (spec.employee && nameSimilarity(spec.employee, p.name) < 0.45) return { issue: "close", candidates: [asCandidate(p, nameSimilarity(spec.employee, p.name))] };
        return { person: p };
      }
    }
    if (!spec.employee) return { skip: `No worker with the employee code ${spec.code} is on record.` };
    const exact = byName.get(exactKey(spec.employee)) ?? [];
    if (exact.length === 1) return { person: exact[0] };
    if (exact.length > 1) return { issue: "several", candidates: exact.map((p) => asCandidate(p, 1)) };
    // Only genuine near-misses count; in a big roster, loosely similar names would bury the real questions.
    const close = rankCandidates(spec.employee, roster.map((p) => ({ id: p.id, name: p.name, employeeIdNo: p.employeeIdNo })), 6, 0.78);
    return { issue: close.length ? "close" : "unknown", candidates: close.map((p) => asCandidate(byId.get(p.id)!, p.score)) };
  }

  const usedCodes = new Set<string>();
  let nextNo = 1;
  /** The code a new worker gets: the file's when it is free, otherwise the next NEW-001. */
  async function freeCode(wanted: string): Promise<string> {
    const free = async (c: string) => !byCode.has(c.toLowerCase()) && !usedCodes.has(c.toLowerCase()) && !(await db.employee.findUnique({ where: { employeeIdNo: c }, select: { id: true } }));
    if (wanted && (await free(wanted))) { usedCodes.add(wanted.toLowerCase()); return wanted; }
    for (;;) { const c = `NEW-${String(nextNo++).padStart(3, "0")}`; if (await free(c)) { usedCodes.add(c.toLowerCase()); return c; } }
  }
  async function createWorker(spec: Spec) {
    const code = await freeCode(spec.code);
    const created = await db.employee.create({ data: { employeeIdNo: code, name: spec.employee || code, trade: spec.trade || null, mobileNumber: spec.mobile || null, branchId } });
    const person = { id: created.id, name: created.name, employeeIdNo: created.employeeIdNo, trade: created.trade ?? null, supplier: null, bed: null } as (typeof roster)[number];
    roster.push(person); byId.set(person.id, person); byCode.set(code.toLowerCase(), person);
    counts.workersCreated++;
    return person;
  }

  /** Puts a worker in a bed of the camp's room: the bed named in the file, else the first free one. */
  async function placeWorker(spec: Spec, camp: { id: string; name: string; ownerType: string; rooms: { id: string; name: string }[] }): Promise<string | null> {
    const label = spec.employee || spec.code;
    const row = { row: spec.row, fileName: label, camp: camp.name, room: spec.room };
    if (camp.ownerType !== "OWN") { placements.push({ ...row, worker: null, bed: null, status: "blocked", note: "Only your own camps have beds." }); return "Only your own camps have beds; supplier and client camps are recorded at check-in."; }
    const r = resolve(spec);
    if ("skip" in r) { placements.push({ ...row, worker: null, bed: null, status: "skipped", note: r.skip }); return r.skip; }
    if ("issue" in r) {
      const key = exactKey(label);
      const have = issues.get(key);
      if (have) have.rows.push(spec.row);
      else issues.set(key, { key, fileName: label, rows: [spec.row], camp: camp.name, room: spec.room, kind: r.issue, candidates: r.candidates, ...(r.issue === "unknown" ? { proposed: { code: spec.code, codeFromFile: !!spec.code, trade: spec.trade || null, mobile: spec.mobile || null } } : {}) });
      counts.needDecision++;
      placements.push({ ...row, worker: null, bed: null, status: "decide", note: r.issue === "several" ? "Several workers share this name." : r.issue === "close" ? "No exact match; close ones found." : "Not on record." });
      return null;
    }
    const person = "create" in r ? await createWorker(spec) : r.person;
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
    const checkIn = spec.checkIn ? new Date(`${spec.checkIn}T12:00:00Z`) : undefined;
    const planned = spec.checkOut && spec.checkOut > todayKey() ? { plannedCheckOutDate: new Date(`${spec.checkOut}T12:00:00Z`), plannedCheckOutReason: "Other", plannedCheckOutNote: "Leaving date from the imported file" } : {};
    await db.accommodationHistory.create({ data: { employeeId: person.id, campName: camp.name, roomName: room.name, bedLabel: bed.label, ...(checkIn ? { checkInDate: checkIn } : {}), ...planned } });
    const open = await db.campCheckIn.findFirst({ where: { employeeId: person.id, status: { in: ["CHECKED_IN", "BED_ALLOCATED"] } }, orderBy: { createdAt: "desc" } });
    if (open) await db.campCheckIn.update({ where: { id: open.id }, data: { campId: camp.id, bedId: bed.id, status: "BED_ALLOCATED", ...(checkIn ? { checkInDate: checkIn } : {}) } });
    else await db.campCheckIn.create({ data: { employeeId: person.id, campId: camp.id, bedId: bed.id, status: "BED_ALLOCATED", branchId, ...(checkIn ? { checkInDate: checkIn } : {}) } });
    await audit({ entityType: "ACCOMMODATION", entityId: bed.id, action: "UPDATE", after: { employeeId: person.id, campName: camp.name, roomName: room.name, bedLabel: bed.label }, userId: ctx.user.id, userName: ctx.user.name, branchId });
    placedNow.add(person.id);
    if (!spec.checkIn) counts.noCheckIn++;
    placements.push({ ...row, worker: personShape(person), bed: bed.label, checkIn: spec.checkIn ?? todayKey(), status: "placed", note: "create" in r ? "New worker added" : spec.checkOut && spec.checkOut > todayKey() ? `Leaving ${spec.checkOut}` : undefined });
    return null;
  }

  /** A worker the file says has already left: the stay is recorded with its dates, and no bed is used. */
  async function recordPastStay(spec: Spec, camp: { id: string; name: string }): Promise<string | null> {
    const label = spec.employee || spec.code;
    const row = { row: spec.row, fileName: label, camp: camp.name, room: spec.room || "—" };
    const r = resolve(spec);
    if ("issue" in r || "skip" in r || "create" in r) {
      const why = "skip" in r ? r.skip : "Left the camp, and couldn't be matched to a worker on record";
      placements.push({ ...row, worker: null, bed: null, status: "skipped", note: `${why}; no history recorded.` });
      return `${why}.`;
    }
    const out = new Date(`${spec.checkOut}T12:00:00Z`);
    const dup = await db.accommodationHistory.findFirst({ where: { employeeId: r.person.id, campName: camp.name, checkOutDate: out }, select: { id: true } });
    if (dup) { placements.push({ ...row, worker: personShape(r.person), bed: null, status: "skipped", note: "This stay is already recorded." }); return null; }
    await db.accommodationHistory.create({ data: { employeeId: r.person.id, campName: camp.name, roomName: spec.room || null, bedLabel: null, checkInDate: new Date(`${spec.checkIn ?? spec.checkOut}T12:00:00Z`), checkOutDate: out, checkOutReason: "Other", checkOutNote: "Left before the import; dates from the file" } });
    counts.pastStays++;
    placements.push({ ...row, worker: personShape(r.person), bed: null, status: "past", note: `Left ${spec.checkOut}` });
    return null;
  }

  /** Beds a room should have per the file: singles plus two berths per bunk; null when the file says nothing. */
  const capacity = (x: { singles: number | null; bunks: number | null }) => (x.singles === null && x.bunks === null ? null : (x.singles ?? 0) + 2 * (x.bunks ?? 0));

  const today = todayKey();
  const notActive = (st: string) => /\b(not\s*active|inactive|left|resigned|terminated|checked\s*out|cancelled)\b/i.test(st);
  /** A worker listed in the file is living there, has already left (with a date), or has left on an unknown date. */
  const kindOf = (sp: Spec): "active" | "past" | "left-unknown" => (sp.checkOut && sp.checkOut <= today ? "past" : notActive(sp.status) ? "left-unknown" : "active");

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

      // A file that lists who sleeps where, but gives no bed counts: size each room to its occupants.
      if ((options.autoBeds ?? "bunks") !== "none") {
        const byRoom = new Map<string, Spec[]>();
        for (const sp of g.specs) if (sp.room) byRoom.set(nameKey(sp.room), [...(byRoom.get(nameKey(sp.room)) ?? []), sp]);
        for (const list of byRoom.values()) {
          if (!list.every((sp) => sp.singles === null && sp.bunks === null)) continue;
          const n = list.filter((sp) => (sp.employee || sp.code) && kindOf(sp) === "active").length;
          if (n === 0) continue;
          if (options.autoBeds === "singles") list[0].singles = n;
          else { list[0].bunks = Math.floor(n / 2); list[0].singles = n % 2; }
        }
      }

      let touched = isNew;
      for (const spec of g.specs) {
        if (!spec.room) continue;
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
        const kind = kindOf(spec);
        if (kind === "left-unknown") {
          placements.push({ row: spec.row, fileName: spec.employee || spec.code, camp: camp.name, room: spec.room, worker: null, bed: null, status: "skipped", note: "Marked not active, with no check-out date, so not placed." });
          counts.notPlaced++;
          continue;
        }
        if (kind === "past") {
          const why = await recordPastStay(spec, camp);
          if (why) { notes.push({ tone: "info", title: `${spec.employee || spec.code} (row ${spec.row}) left the camp`, detail: why }); }
          else touched = true;
          continue;
        }
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
  if (counts.noCheckIn > 0) notes0.push({ tone: "info", title: `${counts.noCheckIn} worker${counts.noCheckIn === 1 ? " has" : "s have"} no check-in date`, detail: "They are checked in on the day of the import. Add a Check in column or date to your file if you want the real dates." });
  return { rows, counts, notes: notes0, placements, placementIssues: [...issues.values()] };
}
