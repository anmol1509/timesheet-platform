import { nameKey, normalizeCode, pickCode } from "@/lib/partyCode";
import type { ApplyCtx, ApplyResult, ImportNote, MappedRow, RowReport } from "../types";
import { auditor, clean, rowsLabel } from "./shared";

const FIELDS = ["fullName", "contactPerson", "contactPhone", "contactEmail", "tradeLicenseNumber", "category", "trn"] as const;

/** Import suppliers (and their parent companies) from mapped rows.
 *
 * A supplier often appears on many rows — a sheet built from timesheet lines
 * repeats it once per line — so rows are first merged per supplier. A parent
 * named on a row that isn't a supplier yet is created as a primary supplier;
 * a supplier naming itself as parent means "primary"; one listed under several
 * parents goes under the one named most often, and the result says so. Names
 * match ignoring case, dots and spacing. Blank cells never clear saved values. */
export async function applySuppliers(ctx: ApplyCtx, input: MappedRow[]): Promise<ApplyResult> {
  const { db, branchId } = ctx;
  const audit = auditor(ctx);
  const rows: RowReport[] = [];
  const counts = { created: 0, updated: 0, merged: 0, failed: 0, parentsCreated: 0 };

  type Group = {
    key: string; name: string; firstRow: number; fields: Record<string, string>; code: string;
    votes: Map<string, { name: string; n: number }>; parentKey: string; parentName: string; conflict: ImportNote | null;
  };
  const groups = new Map<string, Group>();
  const order: Group[] = [];

  for (const { row, values } of input) {
    const name = clean(values.name);
    if (!name) {
      rows.push({ row, status: "error", message: "Supplier name is required." });
      counts.failed++;
      continue;
    }
    const key = nameKey(name);
    let g = groups.get(key);
    if (g) {
      rows.push({ row, name: g.name, status: "skipped", message: `Same supplier as row ${g.firstRow}; merged.` });
      counts.merged++;
    } else {
      g = { key, name, firstRow: row, fields: {}, code: "", votes: new Map(), parentKey: "", parentName: "", conflict: null };
      groups.set(key, g);
      order.push(g);
    }
    for (const f of FIELDS) {
      const v = clean(values[f]);
      if (v && !g.fields[f]) g.fields[f] = v;
    }
    if (!g.code) g.code = normalizeCode(values.code ?? "");
    const parent = clean(values.parent);
    if (parent) {
      const pk = nameKey(parent);
      const vote = pk === key ? "" : pk; // naming itself = "this is a primary supplier"
      const cur = g.votes.get(vote);
      if (cur) cur.n++;
      else g.votes.set(vote, { name: vote === "" ? "" : parent, n: 1 });
    }
  }

  for (const g of order) {
    let best: [string, { name: string; n: number }] | null = null;
    for (const e of g.votes) if (!best || e[1].n > best[1].n || (e[1].n === best[1].n && e[0] === "")) best = e;
    if (best) { g.parentKey = best[0]; g.parentName = best[1].name; }
    if (g.votes.size > 1) {
      const ranked = [...g.votes.values()].sort((x, y) => y.n - x.n);
      const winner = g.parentKey ? g.votes.get(g.parentKey)! : g.votes.get("")!;
      const others = ranked.filter((v) => v !== winner).map((v) => (v.name ? `under ${v.name} (${rowsLabel(v.n)})` : `as a primary supplier (${rowsLabel(v.n)})`));
      g.conflict = {
        tone: "warn",
        title: "Listed under more than one parent",
        detail: `${g.parentKey ? `Placed under ${g.parentName}` : "Kept as a primary supplier"} (${rowsLabel(winner.n)}). Also listed ${others.join(" and ")}. Change it on the supplier's page if that's wrong.`,
      };
    }
  }

  // The branch's suppliers, loaded once and kept current as rows are applied.
  const all = await db.supplier.findMany({ where: { branchId } });
  const byKey = new Map(all.map((x) => [nameKey(x.name), x]));
  const codeOwner = new Map<string, string>();
  for (const x of all) if (x.code) codeOwner.set(x.code, x.id);
  const kids = new Map<string, number>();
  for (const x of all) if (x.parentSupplierId) kids.set(x.parentSupplierId, (kids.get(x.parentSupplierId) ?? 0) + 1);
  const taken = () => new Set<string | null>(codeOwner.keys());

  // A near-match is not merged — it may be a different company — but it is
  // flagged, so an accidental variant ("... Services" / "... Services Est.") is seen.
  const similarTo = (key: string, ...exceptIds: (string | undefined)[]) => {
    if (key.length < 8) return null;
    for (const [k, x] of byKey) {
      if (k === key || exceptIds.includes(x.id) || k.length < 8) continue;
      if (k.includes(key) || key.includes(k)) return x.name;
    }
    return null;
  };

  // Suppliers with no parent first, so every parent exists before its subsidiaries.
  const sorted = [...order].sort((x, y) => Number(!!x.parentKey) - Number(!!y.parentKey) || x.firstRow - y.firstRow);
  let done = 0;

  for (const g of sorted) {
    const row = g.firstRow;
    const notes: ImportNote[] = g.conflict ? [g.conflict] : [];
    const fail = (message: string) => { rows.push({ row, name: g.name, status: "error", message }); counts.failed++; };
    try {
      const existing = byKey.get(g.key);
      const data: Record<string, string> = { ...g.fields };

      if (g.code && g.code !== existing?.code) {
        const owner = codeOwner.get(g.code);
        if (owner && owner !== existing?.id) { fail(`The code ${g.code} is already used by another supplier.`); continue; }
        data.code = g.code;
      }

      let parentId: string | undefined;
      if (g.parentKey) {
        const listedAs = groups.get(g.parentKey);
        if (listedAs?.parentKey) { fail(`"${g.parentName}" is itself listed as a subsidiary, and a parent must be a primary supplier.`); continue; }
        if (existing && (kids.get(existing.id) ?? 0) > 0) { fail(`"${existing.name}" has subsidiaries of its own, so it can't become one.`); continue; }
        let parent = byKey.get(g.parentKey);
        if (!parent) {
          const code = pickCode(g.parentName, taken());
          parent = await db.supplier.create({ data: { name: g.parentName, code, branchId } });
          byKey.set(g.parentKey, parent);
          codeOwner.set(code, parent.id);
          counts.parentsCreated++;
          await audit({ entityType: "SUPPLIER", entityId: parent.id, action: "CREATE", after: { name: g.parentName, code, branchId }, userId: ctx.user.id, userName: ctx.user.name, branchId });
          notes.push({ tone: "info", title: `Added parent "${g.parentName}"`, detail: "It wasn't in your list, so it was created as a primary supplier." });
          const near = similarTo(g.parentKey, parent.id);
          if (near) notes.push({ tone: "warn", title: `"${g.parentName}" looks similar to "${near}"`, detail: "Added separately. Merge them if they're the same company." });
        } else if (parent.parentSupplierId) {
          // A supplier with no subsidiaries of its own is free to become a
          // parent: the file puts others under it, so it is made primary.
          const was = all.find((x) => x.id === parent!.parentSupplierId)?.name ?? "another supplier";
          await db.supplier.update({ where: { id: parent.id }, data: { parentSupplierId: null } });
          kids.set(parent.parentSupplierId, (kids.get(parent.parentSupplierId) ?? 1) - 1);
          await audit({ entityType: "SUPPLIER", entityId: parent.id, action: "UPDATE", before: { parentSupplierId: parent.parentSupplierId }, after: { parentSupplierId: null }, userId: ctx.user.id, userName: ctx.user.name, branchId });
          parent.parentSupplierId = null;
          notes.push({ tone: "info", title: `"${parent.name}" made a primary supplier`, detail: `It was a subsidiary of ${was}, but others are listed under it.` });
        }
        parentId = parent.id;
      }

      if (existing) {
        const update: Record<string, string> = { ...data };
        if (parentId && parentId !== existing.parentSupplierId) update.parentSupplierId = parentId;
        if (Object.keys(update).length > 0) {
          const before = { ...existing } as unknown as Record<string, unknown>;
          await db.supplier.update({ where: { id: existing.id }, data: update });
          if (update.parentSupplierId) {
            if (existing.parentSupplierId) kids.set(existing.parentSupplierId, (kids.get(existing.parentSupplierId) ?? 1) - 1);
            kids.set(parentId!, (kids.get(parentId!) ?? 0) + 1);
          }
          if (update.code) { if (existing.code) codeOwner.delete(existing.code); codeOwner.set(update.code, existing.id); }
          Object.assign(existing, update);
          await audit({ entityType: "SUPPLIER", entityId: existing.id, action: "UPDATE", before, after: update, userId: ctx.user.id, userName: ctx.user.name, branchId });
        }
        rows.push({ row, name: g.name, status: "updated", notes });
        counts.updated++;
      } else {
        const code = data.code ?? pickCode(g.name, taken());
        const create = { name: g.name, ...data, code, ...(parentId ? { parentSupplierId: parentId } : {}), branchId };
        const created = await db.supplier.create({ data: create });
        byKey.set(g.key, created);
        codeOwner.set(code, created.id);
        if (parentId) kids.set(parentId, (kids.get(parentId) ?? 0) + 1);
        await audit({ entityType: "SUPPLIER", entityId: created.id, action: "CREATE", after: create, userId: ctx.user.id, userName: ctx.user.name, branchId });
        const near = similarTo(g.key, created.id, parentId);
        if (near) notes.push({ tone: "warn", title: `Looks similar to "${near}"`, detail: "Added separately. Merge them if they're the same company." });
        rows.push({ row, name: g.name, status: "created", notes });
        counts.created++;
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : "Failed to import row.");
    }
    await ctx.progress?.(++done, sorted.length);
  }

  rows.sort((x, y) => x.row - y.row);
  return { rows, counts, notes: [] };
}
