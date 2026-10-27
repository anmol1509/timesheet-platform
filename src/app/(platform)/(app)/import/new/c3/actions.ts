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
  c3Id: string;
  /** exact: one worker of that name · pick: several of that name · near: no exact name, these look close · none */
  state: "exact" | "pick" | "near" | "none";
  candidates: C3Person[];
  chosen: string | null;
};
export type C3Preview = { error?: string; rows?: C3Row[]; note?: string };

const NAME_HEAD = /name/i;
const ID_HEAD = /c3|emp\s*id|empid|card\s*(no|number|id)|salary\s*card/i;

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

/** Reads a sheet with a name column and a C3 ID column, and says which existing worker each row is. */
export async function previewC3Action(formData: FormData): Promise<C3Preview> {
  const { user, branchId } = await requireUserWithBranch();
  if (!isAdminRole(user.role)) return { error: "Only admins can import." };
  if (!branchId) return { error: "Sign in as a company administrator first." };
  const file = formData.get("file");
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

  // The header is the first row (within the top 15) that has both a name-like and a C3-like heading.
  let head = -1, nameCol = -1, idCol = -1;
  for (let r = 0; r < Math.min(grid.length, 15) && head < 0; r++) {
    const n = grid[r].findIndex((h) => NAME_HEAD.test(h));
    const i = grid[r].findIndex((h, k) => k !== n && ID_HEAD.test(h));
    if (n >= 0 && i >= 0) { head = r; nameCol = n; idCol = i; }
  }
  if (head < 0) return { error: "Couldn't find the columns. The sheet needs a heading with \"name\" and one with the C3 ID (for example \"C3 ID\" or \"EmpId\")." };

  const people = await prisma.employee.findMany({
    where: { branchId },
    select: { id: true, name: true, employeeIdNo: true, c3Id: true, supplier: { select: { name: true } }, sponsorSupplier: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const pool: C3Person[] = people.map((p) => ({ id: p.id, name: p.name, code: p.employeeIdNo, c3Id: p.c3Id, company: p.supplier?.name ?? p.sponsorSupplier?.name ?? null }));

  const rows: C3Row[] = [];
  const seen = new Set<string>();
  for (let r = head + 1; r < grid.length; r++) {
    const name = grid[r][nameCol] ?? "";
    const c3Id = (grid[r][idCol] ?? "").replace(/\.0$/, "");
    if (!name || !c3Id) continue;
    const key = `${name.toLowerCase()}|${c3Id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const exact = pool.filter((p) => sameName(p.name, name));
    if (exact.length === 1) rows.push({ row: r + 1, name, c3Id, state: "exact", candidates: exact, chosen: exact[0].id });
    else if (exact.length > 1) rows.push({ row: r + 1, name, c3Id, state: "pick", candidates: exact.slice(0, 6), chosen: null });
    else {
      const near = nearPeople(name, pool, 3);
      rows.push({ row: r + 1, name, c3Id, state: near.length ? "near" : "none", candidates: near, chosen: null });
    }
    if (rows.length >= 2000) break;
  }
  if (rows.length === 0) return { error: "No rows with both a name and a C3 ID were found." };
  return { rows };
}

/** Saves the chosen links. Each choice is {employeeId, c3Id}; only workers of this branch are touched. */
export async function applyC3Action(links: { employeeId: string; c3Id: string }[]): Promise<{ error?: string; saved?: number; replaced?: number }> {
  const { user, branchId } = await requireUserWithBranch();
  if (!isAdminRole(user.role)) return { error: "Only admins can import." };
  if (!branchId) return { error: "Sign in as a company administrator first." };
  const clean = links.filter((l) => l && typeof l.employeeId === "string" && typeof l.c3Id === "string" && l.c3Id.trim()).slice(0, 2000);
  if (clean.length === 0) return { error: "Nothing to save." };
  // The same worker twice in one file would be ambiguous: keep the last.
  const byEmployee = new Map(clean.map((l) => [l.employeeId, l.c3Id.trim().slice(0, 40)]));
  const found = await prisma.employee.findMany({ where: { branchId, id: { in: [...byEmployee.keys()] } }, select: { id: true, name: true, c3Id: true } });
  let saved = 0, replaced = 0;
  for (const e of found) {
    const next = byEmployee.get(e.id)!;
    if (e.c3Id === next) continue;
    await prisma.employee.update({ where: { id: e.id }, data: { c3Id: next } });
    await logAudit({ entityType: "EMPLOYEE", entityId: e.id, action: "UPDATE", before: { c3Id: e.c3Id }, after: { c3Id: next, via: "C3 import", employee: e.name }, userId: user.id, userName: user.name, branchId });
    saved++;
    if (e.c3Id) replaced++;
  }
  revalidatePath("/employees");
  return { saved, replaced };
}
