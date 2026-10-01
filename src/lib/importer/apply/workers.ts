import { nameKey, pickCode } from "@/lib/partyCode";
import { normalizeNationality } from "@/lib/nationality";
import { loadTradeCanon } from "@/lib/canon";
import { looseMatch } from "@/lib/looseName";
import { WORKER_FIX_FIELDS, checkWorkerFix, dateProblem, workerProblems } from "../workerChecks";
import type { ApplyCtx, ApplyResult, Fix, Fixable, ImportNote, MappedRow, RowReport } from "../types";
import { auditor, clean, parseLooseDate } from "./shared";

const TEXT = ["mobileNumber", "passportNumber", "emiratesId", "laborCardNumber"] as const;
const DATES: [key: string, label: string][] = [
  ["dateOfBirth", "Date of birth"],
  ["joinDate", "Joining date"],
  ["passportExpiry", "Passport expiry"],
  ["emiratesIdExpiry", "Emirates ID expiry"],
  ["visaExpiry", "Visa expiry"],
  ["laborCardExpiry", "Labour card expiry"],
];

const idKey = (s: string) => s.trim().toUpperCase();

function gender(v: string): "MALE" | "FEMALE" | null {
  const g = v.trim().toLowerCase();
  if (["m", "male"].includes(g)) return "MALE";
  if (["f", "female"].includes(g)) return "FEMALE";
  return null;
}

/** Import workers. A worker is identified by ID; a row for an ID that
 * another company already holds is refused (IDs are unique platform-wide, so
 * an update would rewrite their worker). Blank cells never clear saved values. */
export async function applyWorkers(ctx: ApplyCtx, input: MappedRow[], fixes: Fix[] = []): Promise<ApplyResult> {
  const { db, branchId } = ctx;
  const audit = auditor(ctx);
  const rows: RowReport[] = [];
  const counts = { created: 0, updated: 0, merged: 0, failed: 0, suppliersCreated: 0 };

  // Corrections typed in on the review screen replace what the file has, if they pass the same checks.
  const fixList = (Array.isArray(fixes) ? fixes : []).filter((f) => f && f.type === "field" && typeof f.id === "string" && typeof f.field === "string" && WORKER_FIX_FIELDS.has(f.field) && typeof f.value === "string").slice(0, 500);
  for (const f of fixList) {
    const ok = checkWorkerFix(f.field!, f.value);
    if (ok == null) continue;
    for (const r of input) if (idKey(clean(r.values.employeeIdNo)) === idKey(f.id)) r.values[f.field!] = ok;
  }

  type Group = { id: string; firstRow: number; values: Record<string, string>; names: string[] };
  const groups = new Map<string, Group>();
  const order: Group[] = [];
  for (const { row, values } of input) {
    const id = clean(values.employeeIdNo);
    const name = clean(values.name);
    if (!id || !name) {
      rows.push({ row, name: name || undefined, status: "error", message: !id ? "Worker ID is missing." : "Worker name is missing." });
      counts.failed++;
      continue;
    }
    const key = idKey(id);
    const g = groups.get(key);
    if (g) {
      rows.push({ row, name, status: "skipped", message: `Same employee code as row ${g.firstRow}; merged.` });
      counts.merged++;
      if (nameKey(name) !== nameKey(g.values.name) && !g.names.some((n) => nameKey(n) === nameKey(name))) g.names.push(name);
      for (const [k, v] of Object.entries(values)) if (clean(v) && !clean(g.values[k])) g.values[k] = v;
    } else {
      const n = { id, firstRow: row, values: { ...values, employeeIdNo: id, name }, names: [] as string[] };
      groups.set(key, n);
      order.push(n);
    }
  }

  const ids = order.map((g) => g.id);
  // Identity is the passport / Emirates ID, never the name: two workers who share a
  // name are two workers. The same passport under two different codes is what looks like one person entered twice.
  const passKey = (v: string | undefined) => clean(v).replace(/\s+/g, "").toUpperCase();
  const eidKey = (v: string | undefined) => clean(v).replace(/\D/g, "");
  const byPassport = new Map<string, Group[]>();
  const byEid = new Map<string, Group[]>();
  for (const g of order) {
    const p = passKey(g.values.passportNumber), e = eidKey(g.values.emiratesId);
    if (p) byPassport.set(p, [...(byPassport.get(p) ?? []), g]);
    if (e.length >= 10) byEid.set(e, [...(byEid.get(e) ?? []), g]);
  }
  const passList = [...byPassport.keys()], eidList = [...byEid.keys()];
  const holders = passList.length + eidList.length === 0 ? [] : await db.employee.findMany({
    where: { branchId, OR: [...passList.map((p) => ({ passportNumber: { equals: p, mode: "insensitive" as const } })), ...(eidList.length ? [{ emiratesId: { in: eidList.flatMap((e) => [e, `${e.slice(0, 3)}-${e.slice(3, 7)}-${e.slice(7, 14)}-${e.slice(14)}`]) } }] : [])] },
    select: { employeeIdNo: true, name: true, passportNumber: true, emiratesId: true },
  });
  const canonTrade = await loadTradeCanon(db, branchId);
  // Compared ignoring case: "bacc146" in a file is the worker stored as "BACC146".
  const known = await db.employee.findMany({ where: ids.length ? { OR: ids.map((id) => ({ employeeIdNo: { equals: id, mode: "insensitive" as const } })) } : { id: "-" }, select: { id: true, employeeIdNo: true, branchId: true, name: true } });
  const knownByKey = new Map(known.map((e) => [idKey(e.employeeIdNo), e]));

  const suppliers = await db.supplier.findMany({ where: { branchId } });
  const supplierByKey = new Map(suppliers.map((s) => [nameKey(s.name), s]));
  const codes = new Set<string | null>(suppliers.map((s) => s.code));
  const supplierNotes = new Set<string>();
  const supplierFor = async (name: string, notes: ImportNote[], role: string) => {
    const key = nameKey(name);
    let s = supplierByKey.get(key);
    if (!s) {
      // "Prime Build Workforce LLC" is the "Prime Build Workforce" already on file: use it rather than adding a second copy.
      const near = looseMatch(name, [...supplierByKey.values()]);
      if (near) {
        supplierByKey.set(key, near);
        notes.push({ tone: "info", title: `"${name}" matched to your supplier "${near.name}"`, detail: "Same company apart from LLC / Co / Ltd. If they are different companies, rename one of them first." });
        return near;
      }
    }
    if (!s) {
      const code = pickCode(name, codes);
      s = await db.supplier.create({ data: { name, code, branchId } });
      supplierByKey.set(key, s);
      codes.add(code);
      counts.suppliersCreated++;
      await audit({ entityType: "SUPPLIER", entityId: s.id, action: "CREATE", after: { name, code, branchId }, userId: ctx.user.id, userName: ctx.user.name, branchId });
    }
    if (!supplierNotes.has(key + role)) {
      supplierNotes.add(key + role);
    }
    return s;
  };

  let done = 0;
  for (const g of order) {
    const v = g.values;
    const notes: ImportNote[] = [];
    try {
      const other = knownByKey.get(idKey(g.id));
      if (other && other.branchId !== branchId) {
        rows.push({ row: g.firstRow, name: v.name, status: "error", message: "This worker ID is already in use by another company. Use a different ID." });
        counts.failed++;
        continue;
      }

      if (g.names.length > 0) {
        notes.push({ tone: "warn", title: `Code ${g.id} appears with different names`, detail: `${[v.name, ...g.names].join(" / ")}. They were merged as one worker — if they are different people, give each their own code.` });
      }
      if (other && other.branchId === branchId && nameKey(other.name) !== nameKey(v.name)) {
        notes.push({ tone: "warn", title: "Name differs from the worker on file", detail: `On file: ${other.name}. The file says: ${clean(v.name)}. The name was updated.` });
      }
      const p = passKey(v.passportNumber), e = eidKey(v.emiratesId);
      const sameDoc = [
        ...(p ? (byPassport.get(p) ?? []).filter((x) => x !== g).map((x) => ({ code: x.id, name: x.values.name, what: "passport" })) : []),
        ...(e.length >= 10 ? (byEid.get(e) ?? []).filter((x) => x !== g).map((x) => ({ code: x.id, name: x.values.name, what: "Emirates ID" })) : []),
        ...holders.filter((h) => idKey(h.employeeIdNo) !== idKey(g.id) && ((p && passKey(h.passportNumber ?? "") === p) || (e.length >= 10 && eidKey(h.emiratesId ?? "") === e))).map((h) => ({ code: h.employeeIdNo, name: h.name, what: p && passKey(h.passportNumber ?? "") === p ? "passport" : "Emirates ID" })),
      ];
      for (const d of sameDoc) notes.push({ tone: "warn", title: `Same ${d.what} as ${d.name} (${d.code})`, detail: "Two different codes, one document — is this the same person entered twice? Both were kept." });
      const data: Record<string, unknown> = { name: clean(v.name) };
      for (const f of TEXT) if (clean(v[f])) data[f] = clean(v[f]);
      if (clean(v.trade)) data.trade = canonTrade(clean(v.trade));
      const nat = clean(v.nationality);
      if (nat) {
        const r = normalizeNationality(nat);
        if (r.value) {
          data.nationality = r.value;
          if (r.status === "fixed") notes.push({ tone: "info", title: `Nationality "${nat}" saved as ${r.value}` });
        } else if (r.status === "region") {
          notes.push({ tone: "warn", title: `Nationality "${nat}" is a region, not a country`, detail: "Left blank. Use the country, e.g. India or Nepal." });
        } else if (r.status === "unknown") {
          notes.push({ tone: "warn", title: `Nationality "${nat}" wasn't recognised`, detail: "Left blank. Check the spelling, or set it on the worker's page." });
        }
      }
      const gd = clean(v.gender);
      if (gd) {
        const parsed = gender(gd);
        if (parsed) data.gender = parsed;
        else notes.push({ tone: "warn", title: `Gender "${gd}" not recognised`, detail: "Use Male / Female (or M / F). Left blank." });
      }
      for (const [key, label] of DATES) {
        const raw = clean(v[key]);
        if (!raw) continue;
        const d = parseLooseDate(raw);
        if (d === "invalid") notes.push({ tone: "warn", title: `${label} "${raw}" isn't a date`, detail: "Use day/month/year, e.g. 25/12/2026. That field was skipped." });
        else if (d) {
          const why = dateProblem(key, d);
          if (why) notes.push({ tone: "warn", title: `${label} "${raw}" ${why}`, detail: "That field was skipped. Correct it in the \"Fix before importing\" box, or set it on the worker's page." });
          else data[key] = d;
        }
      }
      const supplierName = clean(v.supplier);
      if (supplierName) {
        const before = supplierByKey.has(nameKey(supplierName)) || !!looseMatch(supplierName, [...supplierByKey.values()]);
        data.supplierId = (await supplierFor(supplierName, notes, "S")).id;
        if (!before) notes.push({ tone: "info", title: `Added supplier "${supplierName}"`, detail: "It wasn't in your suppliers yet." });
      }
      const sponsorName = clean(v.sponsor);
      if (sponsorName) {
        const before = supplierByKey.has(nameKey(sponsorName)) || !!looseMatch(sponsorName, [...supplierByKey.values()]);
        data.sponsorSupplierId = (await supplierFor(sponsorName, notes, "P")).id;
        if (!before) notes.push({ tone: "info", title: `Added sponsor "${sponsorName}"`, detail: "It wasn't in your suppliers yet." });
      }

      if (other) {
        const beforeRow = await db.employee.findUnique({ where: { id: other.id } });
        await db.employee.update({ where: { id: other.id }, data: data as never });
        await audit({ entityType: "EMPLOYEE", entityId: other.id, action: "UPDATE", before: beforeRow as unknown as Record<string, unknown>, after: data, userId: ctx.user.id, userName: ctx.user.name, branchId });
        rows.push({ row: g.firstRow, name: v.name, status: "updated", notes });
        counts.updated++;
      } else {
        const created = await db.employee.create({ data: { employeeIdNo: g.id.trim(), status: "IDLE", ...(data as object), branchId } as never });
        knownByKey.set(idKey(g.id), { id: created.id, employeeIdNo: g.id, branchId, name: v.name });
        await audit({ entityType: "EMPLOYEE", entityId: created.id, action: "CREATE", after: { employeeIdNo: g.id, ...data }, userId: ctx.user.id, userName: ctx.user.name, branchId });
        rows.push({ row: g.firstRow, name: v.name, status: "created", notes });
        counts.created++;
      }
    } catch (e) {
      rows.push({ row: g.firstRow, name: v.name, status: "error", message: e instanceof Error ? e.message.split("\n").pop() : "Failed to import row." });
      counts.failed++;
    }
    await ctx.progress?.(++done, order.length);
  }
  rows.sort((a, b) => a.row - b.row);

  // What can still be corrected before importing: shown on the review screen, and gone once fixed.
  const fixables: Fixable[] = [];
  for (const g of order) {
    for (const p of workerProblems(g.values)) {
      if (fixables.length >= 200) break;
      fixables.push({ type: "field", id: g.id, name: clean(g.values.name), field: p.field, label: p.label, reason: p.reason, kind: p.kind, current: p.current });
    }
  }
  return { rows, counts, notes: [], fixables };
}
