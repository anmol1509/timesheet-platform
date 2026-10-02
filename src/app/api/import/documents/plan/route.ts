import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireImporter } from "@/lib/importer/access";
import { EMPLOYEE_DOC_TYPES, SUPPLIER_DOC_TYPE_OPTIONS, extOf, matchOwner, MIME_BY_EXT, readPath, type OwnerMatch } from "@/lib/importer/documentMatch";
import { exactKey } from "@/lib/importer/workerMatch";
import { suggestWorkerMatches } from "@/lib/importer/workerAi";
import type { PlacementIssue } from "@/lib/importer/types";
import { MAX_BULK_FILE_BYTES } from "@/lib/importer/documentLimits";

export const maxDuration = 60;

type FileIn = { index: number; path: string; size: number };

/** Works out who each file belongs to and what it is, from names alone. Nothing is read from the files and nothing is saved. */
export async function POST(request: Request) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const body = (await request.json().catch(() => null)) as { files?: FileIn[] } | null;
  const files = (body?.files ?? []).filter((f) => f && typeof f.path === "string").slice(0, 3000);
  if (files.length === 0) return NextResponse.json({ error: "No files." }, { status: 400 });

  const [employees, suppliers] = await Promise.all([
    prisma.employee.findMany({ where: { branchId: who.branchId }, select: { id: true, name: true, employeeIdNo: true, trade: true, supplier: { select: { name: true } } } }),
    prisma.supplier.findMany({ where: { branchId: who.branchId }, select: { id: true, name: true, code: true, fullName: true } }),
  ]);
  const people = employees.map((e) => ({ id: e.id, name: e.name, code: e.employeeIdNo, trade: e.trade, supplier: e.supplier?.name ?? null }));

  // A single folder wrapped around everything (a zip's own name) isn't a person.
  const firsts = new Set(files.map((f) => f.path.replace(/\\/g, "/").split("/")[0]));
  const multi = files.every((f) => f.path.replace(/\\/g, "/").split("/").length > 1);
  const commonRoot = multi && firsts.size === 1 ? [...firsts][0] : "";

  type Owner = { key: string; text: string; match: OwnerMatch; fileCount: number; ai?: PlacementIssue["ai"] };
  const owners = new Map<string, Owner>();
  const out: { index: number; path: string; name: string; ownerKey: string | null; type: string; status: "ok" | "skip"; reason?: string }[] = [];
  for (const f of files) {
    const name = f.path.replace(/\\/g, "/").split("/").pop() ?? f.path;
    const ext = extOf(name);
    if (name.startsWith(".") || /^(thumbs\.db|desktop\.ini)$/i.test(name) || f.path.includes("__MACOSX")) continue;
    if (!MIME_BY_EXT[ext]) { out.push({ index: f.index, path: f.path, name, ownerKey: null, type: "OTHER", status: "skip", reason: `${ext ? `.${ext}` : "This"} isn't a supported file type.` }); continue; }
    if (f.size > MAX_BULK_FILE_BYTES) { out.push({ index: f.index, path: f.path, name, ownerKey: null, type: "OTHER", status: "skip", reason: `Over ${Math.round(MAX_BULK_FILE_BYTES / 1048576)} MB. Compress it, or add it from the person's page.` }); continue; }
    const r = readPath(f.path, commonRoot);
    let type = r.type?.type ?? "OTHER";
    if (!r.owner) { out.push({ index: f.index, path: f.path, name, ownerKey: null, type, status: "ok", reason: "No name found in the file name." }); continue; }
    const key = exactKey(r.owner.text) || exactKey(r.owner.raw);
    let o = owners.get(key);
    if (!o) {
      o = { key, text: r.owner.text, match: matchOwner(r.owner.text, people, suppliers.map((s) => ({ id: s.id, name: s.name, code: s.code, fullName: s.fullName })), r.type?.owner ?? null, r.owner.raw), fileCount: 0 };
      owners.set(key, o);
    }
    o.fileCount++;
    if (o.match.status === "matched" && o.match.kind === "SUPPLIER" && type === "INSURANCE") type = "WORKMEN_COMPENSATION_INSURANCE";
    out.push({ index: f.index, path: f.path, name, ownerKey: key, type, status: "ok" });
  }

  // Names that are only a close match get the assistant's opinion (workers only; it picks from the shortlist).
  const list = [...owners.values()];
  const issues: PlacementIssue[] = list
    .filter((o) => o.match.status === "close" || o.match.status === "several")
    .map((o) => ({
      key: o.key, fileName: o.text, rows: [], camp: "", room: "", kind: o.match.status as "close" | "several",
      candidates: (o.match as Extract<OwnerMatch, { candidates: unknown }>).candidates.filter((c) => c.kind === "EMPLOYEE").map((c) => ({ id: c.id, name: c.name, code: c.sub.split(" · ")[0] ?? "", trade: null, supplier: null, housed: null, score: c.score })),
    }))
    .filter((i) => i.candidates.length > 0);
  if (issues.length) for (const i of await suggestWorkerMatches(issues)) { const o = owners.get(i.key); if (o && i.ai) o.ai = i.ai; }

  return NextResponse.json({
    owners: list,
    files: out,
    employeeTypes: EMPLOYEE_DOC_TYPES,
    supplierTypes: SUPPLIER_DOC_TYPE_OPTIONS,
    pickList: {
      employees: people.slice(0, 5000).map((p) => ({ id: p.id, label: `${p.name} (${p.code})` })),
      suppliers: suppliers.map((s) => ({ id: s.id, label: s.name })),
    },
  });
}
