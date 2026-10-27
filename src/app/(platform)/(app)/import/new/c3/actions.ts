"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { logAudit } from "@/lib/audit";
import { loadWorkbook } from "@/lib/importer/sheet";
import { nearPeople, sameName } from "@/lib/people";

export type C3Person = { id: string; name: string; code: string; c3Id: string | null; company: string | null };
export type C3Row = {
  row: number;
  name: string;
  /** The worker's own employee ID (code) from the sheet, when it has one. */
  code: string;
  c3Id: string;
  /** exact: one worker matched · pick: several of that name · near: no exact match, these look close · mismatch: the ID and the name point to different people · none */
  state: "exact" | "pick" | "near" | "mismatch" | "none";
  /** What found the worker: their employee ID, or their name. */
  via: "id" | "name" | null;
  candidates: C3Person[];
  chosen: string | null;
};
export type C3Inspect = { error?: string; headerRow?: number; headers?: string[]; sample?: string[][]; rowCount?: number; suggest?: { name: number; code: number; c3: number } };
export type C3Preview = { error?: string; rows?: C3Row[] };

const NAME_HEAD = /name/i;
const C3_HEAD = /c3|salary\s*card|card\s*(no|number|id)/i;
const LOOSE_ID_HEAD = /emp\s*id|empid/i;
const CODE_HEAD = /employee\s*(code|id|no)|emp\s*(code|no)|worker\s*(id|code)|staff\s*(id|code)|labou?r\s*(id|code)|id\s*no|company\s*code|^code$/i;

function cell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cell(o.result);
    if ("text" in o) return cell(o.text);
    if (Array.isArray(o.richText)) return o.richText.map((r) => String((r as { text?: string }).text ?? "")).join("").trim();
    return "";
  }
  return String(v).trim();
}

async function admin() {
  const { user, branchId } = await requireUserWithBranch();
  if (!isAdminRole(user.role)) return { error: "Only admins can import." } as const;
  if (!branchId) return { error: "Sign in as a company administrator first." } as const;
  return { user, branchId } as const;
}

/** The file as rows of text, first sheet only. */
async function readGrid(file: FormDataEntryValue | null): Promise<{ grid: string[][] } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  if (file.size > 5_000_000) return { error: "That file is too big (limit 5 MB)." };
  const grid: string[][] = [];
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (/\.xls$/i.test(file.name)) {
      // The older Excel format: read with the xls reader (loaded only here), first sheet, every cell as text.
      const XLSX = await import("@e965/xlsx");
      const book = XLSX.read(bytes, { type: "buffer", cellDates: true });
      const sheet = book.Sheets[book.SheetNames[0]];
      if (!sheet) return { error: "The file has no sheet." };
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
      for (const r of rows) grid.push(r.map((v) => String(v ?? "").trim()));
    } else {
      const wb = await loadWorkbook(bytes, file.name);
      const ws = wb.worksheets[0];
      if (!ws) return { error: "The file has no sheet." };
      for (let r = 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const out: string[] = [];
        for (let c = 1; c <= ws.columnCount; c++) out.push(cell(row.getCell(c).value));
        grid.push(out);
      }
    }
  } catch {
    return { error: "Couldn't read that file. Use an .xls, .xlsx or .csv." };
  }
  return { grid };
}

/** Which columns hold the name, the worker's own employee ID and the C3 ID. A sheet that only has an "EmpId" column is read as the C3 ID. */
function suggestColumns(headers: string[]): { name: number; code: number; c3: number } {
  const find = (re: RegExp, not: number[] = []) => headers.findIndex((h, i) => !not.includes(i) && re.test(h));
  let c3 = find(C3_HEAD);
  const name = find(NAME_HEAD, [c3]);
  let code = find(CODE_HEAD, [c3, name]);
  if (c3 < 0) {
    const loose = find(LOOSE_ID_HEAD, [name]);
    if (loose >= 0) { c3 = loose; code = find(CODE_HEAD, [c3, name]); }
  }
  return { name, code, c3 };
}

/** Step 1: finds the heading row and guesses which column is which. Nothing is matched or saved yet. */
export async function inspectC3Action(formData: FormData): Promise<C3Inspect> {
  const who = await admin();
  if ("error" in who) return { error: who.error };
  const read = await readGrid(formData.get("file"));
  if ("error" in read) return { error: read.error };
  const { grid } = read;
  let head = -1;
  for (let r = 0; r < Math.min(grid.length, 15) && head < 0; r++) {
    const s = suggestColumns(grid[r]);
    if (s.c3 >= 0 && (s.name >= 0 || s.code >= 0)) head = r;
  }
  if (head < 0) head = grid.findIndex((r) => r.some(Boolean));
  if (head < 0) return { error: "The file is empty." };
  const headers = grid[head].map((h, i) => h || `Column ${i + 1}`);
  const rowCount = grid.slice(head + 1).filter((r) => r.some(Boolean)).length;
  return { headerRow: head + 1, headers, sample: grid.slice(head + 1, head + 4), rowCount, suggest: suggestColumns(grid[head]) };
}

/** Step 3: with the columns confirmed, says which existing worker each row is. */
export async function previewC3Action(formData: FormData): Promise<C3Preview> {
  const who = await admin();
  if ("error" in who) return { error: who.error };
  const read = await readGrid(formData.get("file"));
  if ("error" in read) return { error: read.error };
  const { grid } = read;
  const idx = (k: string) => { const n = Number(formData.get(k)); return Number.isInteger(n) && n >= 0 ? n : -1; };
  const headerRow = Math.max(1, Number(formData.get("headerRow")) || 1);
  const nameCol = idx("nameCol"), codeCol = idx("codeCol"), c3Col = idx("c3Col");
  if (c3Col < 0) return { error: "Choose the column that holds the C3 ID." };
  if (nameCol < 0 && codeCol < 0) return { error: "Choose the worker name column, the employee ID column, or both." };

  const people = await prisma.employee.findMany({
    where: { branchId: who.branchId },
    select: { id: true, name: true, employeeIdNo: true, c3Id: true, supplier: { select: { name: true } }, sponsorSupplier: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const pool: C3Person[] = people.map((p) => ({ id: p.id, name: p.name, code: p.employeeIdNo, c3Id: p.c3Id, company: p.supplier?.name ?? p.sponsorSupplier?.name ?? null }));
  const byCode = new Map<string, C3Person[]>();
  for (const p of pool) { const k = p.code.trim().toLowerCase(); if (k) byCode.set(k, [...(byCode.get(k) ?? []), p]); }

  const rows: C3Row[] = [];
  const seen = new Set<string>();
  for (let r = headerRow; r < grid.length; r++) {
    const name = nameCol >= 0 ? grid[r][nameCol] ?? "" : "";
    const code = codeCol >= 0 ? (grid[r][codeCol] ?? "").replace(/\.0$/, "") : "";
    const c3Id = (grid[r][c3Col] ?? "").replace(/\.0$/, "");
    if ((!name && !code) || !c3Id) continue;
    const key = `${name.toLowerCase()}|${code.toLowerCase()}|${c3Id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const base = { row: r + 1, name, code, c3Id };

    // The employee ID is the surest way to say who it is; the name is checked against it.
    const byId = code ? byCode.get(code.toLowerCase()) ?? [] : [];
    if (byId.length === 1) {
      const p = byId[0];
      const agrees = !name || sameName(p.name, name) || nearPeople(name, [p], 1).length > 0;
      rows.push(agrees ? { ...base, state: "exact", via: "id", candidates: [p], chosen: p.id } : { ...base, state: "mismatch", via: "id", candidates: [p, ...pool.filter((x) => x.id !== p.id && sameName(x.name, name)).slice(0, 3)], chosen: null });
      if (rows.length >= 2000) break;
      continue;
    }
    if (name) {
      const exact = pool.filter((p) => sameName(p.name, name));
      if (exact.length === 1) rows.push({ ...base, state: "exact", via: "name", candidates: exact, chosen: exact[0].id });
      else if (exact.length > 1) rows.push({ ...base, state: "pick", via: "name", candidates: exact.slice(0, 6), chosen: null });
      else {
        const near = nearPeople(name, pool, 3);
        rows.push({ ...base, state: near.length ? "near" : "none", via: null, candidates: near, chosen: null });
      }
    } else {
      rows.push({ ...base, state: "none", via: null, candidates: [], chosen: null });
    }
    if (rows.length >= 2000) break;
  }
  if (rows.length === 0) return { error: "No rows with a C3 ID and a name or employee ID were found. Check the columns you chose." };
  return { rows };
}

export type C3Change = { employeeId: string; before: string | null; after: string };

/** Step 4: saves the chosen links. Only workers of this company are touched. Returns what changed, so it can be undone. */
export async function applyC3Action(links: { employeeId: string; c3Id: string }[]): Promise<{ error?: string; saved?: number; replaced?: number; unchanged?: number; changes?: C3Change[] }> {
  const who = await admin();
  if ("error" in who) return { error: who.error };
  const { user, branchId } = who;
  const clean = links.filter((l) => l && typeof l.employeeId === "string" && typeof l.c3Id === "string" && l.c3Id.trim()).slice(0, 2000);
  if (clean.length === 0) return { error: "Nothing to save." };
  // The same worker twice in one file would be ambiguous: keep the last.
  const byEmployee = new Map(clean.map((l) => [l.employeeId, l.c3Id.trim().slice(0, 40)]));
  const found = await prisma.employee.findMany({ where: { branchId, id: { in: [...byEmployee.keys()] } }, select: { id: true, name: true, c3Id: true } });
  let replaced = 0, unchanged = 0;
  const changes: C3Change[] = [];
  for (const e of found) {
    const next = byEmployee.get(e.id)!;
    if (e.c3Id === next) { unchanged++; continue; }
    await prisma.employee.update({ where: { id: e.id }, data: { c3Id: next } });
    await logAudit({ entityType: "EMPLOYEE", entityId: e.id, action: "UPDATE", before: { c3Id: e.c3Id }, after: { c3Id: next, via: "C3 import", employee: e.name }, userId: user.id, userName: user.name, branchId });
    changes.push({ employeeId: e.id, before: e.c3Id, after: next });
    if (e.c3Id) replaced++;
  }
  revalidatePath("/employees");
  return { saved: changes.length, replaced, unchanged, changes };
}

/** Puts back what the last save changed. A worker whose C3 ID was changed again since is left alone. */
export async function undoC3Action(changes: C3Change[]): Promise<{ error?: string; restored?: number; kept?: number }> {
  const who = await admin();
  if ("error" in who) return { error: who.error };
  const { user, branchId } = who;
  const list = (Array.isArray(changes) ? changes : []).filter((c) => c && typeof c.employeeId === "string" && typeof c.after === "string").slice(0, 2000);
  if (list.length === 0) return { error: "Nothing to undo." };
  const found = await prisma.employee.findMany({ where: { branchId, id: { in: list.map((c) => c.employeeId) } }, select: { id: true, name: true, c3Id: true } });
  const now = new Map(found.map((e) => [e.id, e]));
  let restored = 0, kept = 0;
  for (const c of list) {
    const e = now.get(c.employeeId);
    if (!e || e.c3Id !== c.after) { kept++; continue; }
    await prisma.employee.update({ where: { id: e.id }, data: { c3Id: c.before } });
    await logAudit({ entityType: "EMPLOYEE", entityId: e.id, action: "UPDATE", before: { c3Id: e.c3Id }, after: { c3Id: c.before, via: "C3 import undone", employee: e.name }, userId: user.id, userName: user.name, branchId });
    restored++;
  }
  revalidatePath("/employees");
  return { restored, kept };
}
