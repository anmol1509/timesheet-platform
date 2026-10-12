import { nameKey, normalizeCode, pickCode, CLIENT_PREFIX } from "@/lib/partyCode";
import type { ApplyCtx, ApplyResult, ImportNote, MappedRow, RowReport } from "../types";
import { auditor, clean } from "./shared";

const FIELDS = ["contactPerson", "contactPhone", "contactEmail", "trn", "tradeLicenseNumber", "billingAddress", "paymentTerms"] as const;

/** Import clients. Repeated rows are merged, names match ignoring case, dots
 * and spacing, and a blank cell never clears a saved value. */
export async function applyClients(ctx: ApplyCtx, input: MappedRow[]): Promise<ApplyResult> {
  const { db, branchId } = ctx;
  const audit = auditor(ctx);
  const rows: RowReport[] = [];
  const counts = { created: 0, updated: 0, merged: 0, failed: 0 };

  type Group = { key: string; name: string; firstRow: number; fields: Record<string, string>; code: string };
  const groups = new Map<string, Group>();
  const order: Group[] = [];
  for (const { row, values } of input) {
    const name = clean(values.name);
    if (!name) { rows.push({ row, status: "error", message: "Company name is required." }); counts.failed++; continue; }
    const key = nameKey(name);
    let g = groups.get(key);
    if (g) {
      rows.push({ row, name: g.name, status: "skipped", message: `Same client as row ${g.firstRow}; merged.` });
      counts.merged++;
    } else {
      g = { key, name, firstRow: row, fields: {}, code: "" };
      groups.set(key, g);
      order.push(g);
    }
    for (const f of FIELDS) { const v = clean(values[f]); if (v && !g.fields[f]) g.fields[f] = v; }
    if (!g.code) g.code = normalizeCode(values.code ?? "");
  }

  const all = await db.client.findMany({ where: { branchId } });
  const byKey = new Map(all.map((c) => [nameKey(c.name), c]));
  const codeOwner = new Map<string, string>();
  for (const c of all) if (c.code) codeOwner.set(c.code, c.id);
  let done = 0;

  for (const g of order) {
    const notes: ImportNote[] = [];
    try {
      const existing = byKey.get(g.key);
      const data: Record<string, string> = { ...g.fields };
      if (g.code && g.code !== existing?.code) {
        const owner = codeOwner.get(g.code);
        if (owner && owner !== existing?.id) {
          rows.push({ row: g.firstRow, name: g.name, status: "error", message: `The code ${g.code} is already used by another client.` });
          counts.failed++;
          continue;
        }
        data.code = g.code;
      }
      if (existing) {
        if (Object.keys(data).length > 0) {
          const before = { ...existing } as unknown as Record<string, unknown>;
          await db.client.update({ where: { id: existing.id }, data });
          if (data.code) { if (existing.code) codeOwner.delete(existing.code); codeOwner.set(data.code, existing.id); }
          Object.assign(existing, data);
          await audit({ entityType: "CLIENT", entityId: existing.id, action: "UPDATE", before, after: data, userId: ctx.user.id, userName: ctx.user.name, branchId });
        }
        rows.push({ row: g.firstRow, name: g.name, status: "updated", notes });
        counts.updated++;
      } else {
        const code = data.code ?? pickCode(g.name, new Set<string | null>(codeOwner.keys()), CLIENT_PREFIX);
        const create = { name: g.name, ...data, code, branchId };
        const created = await db.client.create({ data: create });
        byKey.set(g.key, created);
        codeOwner.set(code, created.id);
        await audit({ entityType: "CLIENT", entityId: created.id, action: "CREATE", after: create, userId: ctx.user.id, userName: ctx.user.name, branchId });
        rows.push({ row: g.firstRow, name: g.name, status: "created", notes });
        counts.created++;
      }
    } catch (e) {
      rows.push({ row: g.firstRow, name: g.name, status: "error", message: e instanceof Error ? e.message : "Failed to import row." });
      counts.failed++;
    }
    await ctx.progress?.(++done, order.length);
  }
  rows.sort((a, b) => a.row - b.row);
  return { rows, counts, notes: [] };
}
