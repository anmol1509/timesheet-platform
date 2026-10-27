import { nameKey, normalizeCode, pickCode } from "@/lib/partyCode";
import { OWNER_ROLE, equalSplit, isValidShare, ownershipSummary } from "@/lib/ownership";
import type { ApplyCtx, ApplyResult, ImportNote, MappedRow, RowReport } from "../types";
import { auditor, clean, parseLooseDate, rowsLabel } from "./shared";

const TEXT = ["fullName", "tradeLicenseNumber", "mohrePermitNumber", "country", "emirate", "location", "poBox", "phone", "contactEmail", "contactPerson", "contactPhone", "signatoryName", "signatoryTitle"] as const;
const DATES = [["activeFrom", "Active from"], ["tradeLicenseExpiry", "Trade licence expiry"]] as const;
const OWNER_SLOTS = [1, 2, 3] as const;
const SPONSOR_SLOTS = [1, 2] as const;

/**
 * Import the company's own entities (My Companies) from mapped rows. Like the supplier import, a company named on several rows is
 * merged, names match ignoring case and spacing, blank cells never clear saved values, and a subsidiary goes under the company
 * named as its parent (added as one of your own if it is not on record yet). On top of that it reads the licence and permit details,
 * the signatory, and the owners with their shares and sponsors, which are shared people: the same name in two companies is one person.
 * A name that is already on record as an ordinary supplier is left alone and reported, never turned into one of your own.
 */
export async function applyCompanies(ctx: ApplyCtx, input: MappedRow[]): Promise<ApplyResult> {
  const { db, branchId } = ctx;
  const audit = auditor(ctx);
  const rows: RowReport[] = [];
  const counts = { created: 0, updated: 0, merged: 0, failed: 0, parentsCreated: 0, peopleAdded: 0 };

  type Slot = { name: string; percent: string };
  type Group = { key: string; name: string; firstRow: number; fields: Record<string, string>; code: string; parentKey: string; parentName: string; owners: Slot[]; sponsors: string[]; notes: ImportNote[] };
  const groups = new Map<string, Group>();
  const order: Group[] = [];

  for (const { row, values } of input) {
    const name = clean(values.name);
    if (!name) { rows.push({ row, status: "error", message: "Company name is required." }); counts.failed++; continue; }
    const key = nameKey(name);
    let g = groups.get(key);
    if (g) {
      rows.push({ row, name: g.name, status: "skipped", message: `Same company as row ${g.firstRow}; merged.` });
      counts.merged++;
    } else {
      g = { key, name, firstRow: row, fields: {}, code: "", parentKey: "", parentName: "", owners: [], sponsors: [], notes: [] };
      groups.set(key, g);
      order.push(g);
    }
    for (const f of [...TEXT, "trn", "activeFrom", "tradeLicenseExpiry"] as const) {
      const v = clean(values[f]);
      if (v && !g.fields[f]) g.fields[f] = v;
    }
    if (!g.code) g.code = normalizeCode(values.code ?? "");
    const parent = clean(values.parent);
    if (parent && !g.parentKey && nameKey(parent) !== key) { g.parentKey = nameKey(parent); g.parentName = parent; }
    for (const n of OWNER_SLOTS) {
      const owner = clean(values[`owner${n}`]);
      if (owner && !g.owners.some((o) => nameKey(o.name) === nameKey(owner))) g.owners.push({ name: owner, percent: clean(values[`owner${n}Percent`]).replace(/%$/, "").trim() });
    }
    for (const n of SPONSOR_SLOTS) {
      const sp = clean(values[`sponsor${n}`]);
      if (sp && !g.sponsors.some((x) => nameKey(x) === nameKey(sp))) g.sponsors.push(sp);
    }
  }

  const all = await db.supplier.findMany({ where: { branchId } });
  const byKey = new Map(all.map((x) => [nameKey(x.name), x]));
  const codeOwner = new Map<string, string>();
  for (const x of all) if (x.code) codeOwner.set(x.code, x.id);
  const kids = new Map<string, number>();
  for (const x of all) if (x.parentSupplierId) kids.set(x.parentSupplierId, (kids.get(x.parentSupplierId) ?? 0) + 1);
  const taken = () => new Set<string | null>(codeOwner.keys());

  // The people already on record, so a name that is already there is reused. Kept current as new ones are added.
  const people = await db.supplierParty.findMany({ where: { branchId }, select: { id: true, name: true } });
  const personByKey = new Map(people.map((p) => [nameKey(p.name), p.id]));
  const personFor = async (name: string): Promise<string> => {
    const k = nameKey(name);
    const found = personByKey.get(k);
    if (found) return found;
    const made = await db.supplierParty.create({ data: { branchId, name: name.slice(0, 120) } });
    personByKey.set(k, made.id);
    counts.peopleAdded++;
    return made.id;
  };

  // Main companies first, so every parent exists before its subsidiaries.
  const sorted = [...order].sort((x, y) => Number(!!x.parentKey) - Number(!!y.parentKey) || x.firstRow - y.firstRow);
  let done = 0;

  for (const g of sorted) {
    const row = g.firstRow;
    const notes: ImportNote[] = [...g.notes];
    const fail = (message: string) => { rows.push({ row, name: g.name, status: "error", message }); counts.failed++; };
    try {
      const existing = byKey.get(g.key);
      if (existing && !existing.isOwnCompany) { fail("Already on record as a supplier, so it was left alone. Rename one of them, or use Suppliers if this is not your own company."); continue; }

      const data: Record<string, string | Date | null> = {};
      for (const f of TEXT) if (g.fields[f]) data[f] = g.fields[f].slice(0, 200);
      if (g.fields.trn) {
        const trn = g.fields.trn.replace(/\s|-/g, "");
        if (/^\d{15}$/.test(trn)) data.trn = trn;
        else notes.push({ tone: "warn", title: `TRN "${g.fields.trn}" was not saved`, detail: "A TRN is 15 digits. Add it on the company's page." });
      }
      let badDate = false;
      for (const [f, label] of DATES) {
        if (!g.fields[f]) continue;
        const d = parseLooseDate(g.fields[f]);
        if (d === "invalid" || d === null) { notes.push({ tone: "warn", title: `${label} "${g.fields[f]}" was not understood`, detail: "Write it as day/month/year, e.g. 31/01/2027. Left as it was." }); badDate = true; }
        else data[f] = d;
      }
      void badDate;

      if (g.code && g.code !== existing?.code) {
        const owner = codeOwner.get(g.code);
        if (owner && owner !== existing?.id) { fail(`The code ${g.code} is already used by another company.`); continue; }
        data.code = g.code;
      }

      let parentId: string | undefined;
      if (g.parentKey) {
        const listedAs = groups.get(g.parentKey);
        if (listedAs?.parentKey) { fail(`"${g.parentName}" is itself listed as part of another company, and a parent must be a main company.`); continue; }
        if (existing && (kids.get(existing.id) ?? 0) > 0) { fail(`"${existing.name}" has subsidiaries of its own, so it can't become one.`); continue; }
        let parent = byKey.get(g.parentKey);
        if (parent && !parent.isOwnCompany) { fail(`"${g.parentName}" is on record as a supplier, not one of your own companies, so it can't be a parent here.`); continue; }
        if (!parent) {
          const code = pickCode(g.parentName, taken());
          parent = await db.supplier.create({ data: { name: g.parentName, code, branchId, isOwnCompany: true, status: "ACTIVE" } });
          byKey.set(g.parentKey, parent);
          codeOwner.set(code, parent.id);
          counts.parentsCreated++;
          await audit({ entityType: "SUPPLIER", entityId: parent.id, action: "CREATE", after: { name: g.parentName, code, isOwnCompany: true, branchId }, userId: ctx.user.id, userName: ctx.user.name, branchId });
          notes.push({ tone: "info", title: `Added parent "${g.parentName}"`, detail: "It wasn't in your list, so it was created as one of your own main companies. Fill in its details on its page." });
        } else if (parent.parentSupplierId) {
          const was = all.find((x) => x.id === parent!.parentSupplierId)?.name ?? "another company";
          await db.supplier.update({ where: { id: parent.id }, data: { parentSupplierId: null } });
          kids.set(parent.parentSupplierId, (kids.get(parent.parentSupplierId) ?? 1) - 1);
          parent.parentSupplierId = null;
          notes.push({ tone: "info", title: `"${parent.name}" made a main company`, detail: `It was part of ${was}, but others are listed under it.` });
        }
        parentId = parent.id;
      }

      let companyId: string;
      if (existing) {
        const update: Record<string, string | Date | null> = { ...data };
        if (parentId && parentId !== existing.parentSupplierId) update.parentSupplierId = parentId;
        if (Object.keys(update).length > 0) {
          const before = { ...existing } as unknown as Record<string, unknown>;
          await db.supplier.update({ where: { id: existing.id }, data: update });
          if (update.parentSupplierId) {
            if (existing.parentSupplierId) kids.set(existing.parentSupplierId, (kids.get(existing.parentSupplierId) ?? 1) - 1);
            kids.set(parentId!, (kids.get(parentId!) ?? 0) + 1);
          }
          if (update.code) { if (existing.code) codeOwner.delete(existing.code); codeOwner.set(update.code as string, existing.id); }
          Object.assign(existing, update);
          await audit({ entityType: "SUPPLIER", entityId: existing.id, action: "UPDATE", before, after: update, userId: ctx.user.id, userName: ctx.user.name, branchId });
        }
        companyId = existing.id;
        counts.updated++;
      } else {
        const code = (data.code as string | undefined) ?? pickCode(g.name, taken());
        const create = { name: g.name, ...data, code, ...(parentId ? { parentSupplierId: parentId } : {}), isOwnCompany: true, status: "ACTIVE", branchId };
        const created = await db.supplier.create({ data: create as never });
        byKey.set(g.key, created);
        codeOwner.set(code, created.id);
        if (parentId) kids.set(parentId, (kids.get(parentId) ?? 0) + 1);
        await audit({ entityType: "SUPPLIER", entityId: created.id, action: "CREATE", after: create, userId: ctx.user.id, userName: ctx.user.name, branchId });
        companyId = created.id;
        counts.created++;
      }

      // Owners and sponsors: shared people, linked to this company. Existing links are kept; shares are only set when the file gives them.
      if (g.owners.length > 0) {
        const given = g.owners.map((o) => (o.percent === "" ? null : Number(o.percent)));
        const valid = given.every((p) => p === null || isValidShare(p));
        let shares: (number | null)[] = given;
        if (!valid) { notes.push({ tone: "warn", title: "An owner's share was not understood", detail: "Shares are whole numbers from 1 to 100. The shares were not saved; set them on the company's page." }); shares = g.owners.map(() => null); }
        else if (given.every((p) => p === null)) shares = equalSplit(g.owners.length);
        else {
          const s = ownershipSummary(given);
          if (!s.ok) notes.push({ tone: "warn", title: "Owners' shares do not add up to 100%", detail: s.unset > 0 ? "Some owners have no share. Set them on the company's page." : `They add up to ${s.total}%. Correct them on the company's page.` });
        }
        for (let i = 0; i < g.owners.length; i++) {
          const partyId = await personFor(g.owners[i].name);
          const link = await db.supplierPartyLink.findUnique({ where: { supplierId_partyId_role: { supplierId: companyId, partyId, role: OWNER_ROLE } } });
          if (link) { if (shares[i] !== null && link.ownershipPercent !== shares[i]) await db.supplierPartyLink.update({ where: { id: link.id }, data: { ownershipPercent: shares[i] } }); }
          else await db.supplierPartyLink.create({ data: { supplierId: companyId, partyId, role: OWNER_ROLE, ownershipPercent: shares[i], branchId } });
        }
      }
      for (const sp of g.sponsors) {
        const partyId = await personFor(sp);
        const link = await db.supplierPartyLink.findUnique({ where: { supplierId_partyId_role: { supplierId: companyId, partyId, role: "SPONSOR" } } });
        if (!link) await db.supplierPartyLink.create({ data: { supplierId: companyId, partyId, role: "SPONSOR", ownershipPercent: null, branchId } });
      }
      rows.push({ row, name: g.name, status: existing ? "updated" : "created", notes });
    } catch (e) {
      fail(e instanceof Error ? e.message : "Failed to import row.");
    }
    await ctx.progress?.(++done, sorted.length);
  }

  rows.sort((x, y) => x.row - y.row);
  const merged = counts.merged ? [{ tone: "info" as const, title: `${rowsLabel(counts.merged)} repeated a company already in the file`, detail: "They were merged into one." }] : [];
  return { rows, counts, notes: merged };
}
