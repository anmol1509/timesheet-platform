import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireImporter } from "@/lib/importer/access";
import { EMPLOYEE_DOC_TYPES, SUPPLIER_DOC_TYPE_OPTIONS, extOf, matchOwner, MIME_BY_EXT, readPath, type OwnerMatch, type Person, type Company } from "@/lib/importer/documentMatch";
import { ID_FIELDS, idKey, type Audience, type Confidence } from "@/lib/importer/documentRead";
import { exactKey } from "@/lib/importer/workerMatch";
import { suggestWorkerMatches } from "@/lib/importer/workerAi";
import type { PlacementIssue } from "@/lib/importer/types";
import { MAX_BULK_FILE_BYTES } from "@/lib/importer/documentLimits";

export const maxDuration = 60;

type DocIn = { docKey: string; type: string; holder: string; idNumber: string; expiry: string; confidence: Confidence; pages: number[] };
type FileIn = { index: number; path: string; size: number; docs?: DocIn[] };
type Via = "number" | "name" | "folder or file name";

/**
 * Works out who each document belongs to. A document the AI read is matched by its own number first
 * (passport, Emirates ID, licence), then by the name on it, then by the folder or file name. Nothing is
 * read from the files here and nothing is saved.
 */
export async function POST(request: Request) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const body = (await request.json().catch(() => null)) as { audience?: Audience; files?: FileIn[] } | null;
  const audience: Audience = body?.audience === "SUPPLIER" ? "SUPPLIER" : "EMPLOYEE";
  const files = (body?.files ?? []).filter((f) => f && typeof f.path === "string").slice(0, 3000);
  if (files.length === 0) return NextResponse.json({ error: "No files." }, { status: 400 });
  const typeOptions = audience === "EMPLOYEE" ? EMPLOYEE_DOC_TYPES : SUPPLIER_DOC_TYPE_OPTIONS;
  const validTypes = new Set(typeOptions.map((t) => t.value));

  type Rec = Record<string, string | null>;
  let people: Person[] = [];
  let companies: Company[] = [];
  const recs = new Map<string, Rec>();
  const photos = new Set<string>();
  if (audience === "EMPLOYEE") {
    const rows = await prisma.employee.findMany({ where: { branchId: who.branchId }, select: { id: true, name: true, employeeIdNo: true, trade: true, photoMimeType: true, passportNumber: true, emiratesId: true, laborCardNumber: true, laborCardPersonalNo: true, visaNumber: true, unifiedNo: true, supplier: { select: { name: true } } } });
    people = rows.map((e) => ({ id: e.id, name: e.name, code: e.employeeIdNo, trade: e.trade, supplier: e.supplier?.name ?? null }));
    for (const e of rows) { recs.set(e.id, e as unknown as Rec); if (e.photoMimeType) photos.add(e.id); }
  } else {
    const rows = await prisma.supplier.findMany({ where: { branchId: who.branchId }, select: { id: true, name: true, code: true, fullName: true, tradeLicenseNumber: true, mohrePermitNumber: true, trn: true } });
    companies = rows.map((s) => ({ id: s.id, name: s.name, code: s.code, fullName: s.fullName }));
    for (const s of rows) recs.set(s.id, s as unknown as Rec);
  }
  const kind = audience;

  // A single folder wrapped around everything (a zip's own name) isn't a person.
  const firsts = new Set(files.map((f) => f.path.replace(/\\/g, "/").split("/")[0]));
  const multi = files.every((f) => f.path.replace(/\\/g, "/").split("/").length > 1);
  const commonRoot = multi && firsts.size === 1 ? [...firsts][0] : "";

  const byNumber = (type: string, idNumber: string): string | null => {
    const key = idKey(idNumber);
    if (key.length < 5) return null;
    const fields = ID_FIELDS[kind][type] ?? Object.values(ID_FIELDS[kind]).flat();
    const hits = new Set<string>();
    for (const [id, rec] of recs) for (const f of fields) if (rec[f] && idKey(rec[f]) === key) hits.add(id);
    return hits.size === 1 ? [...hits][0] : null;
  };
  const nameMatch = (text: string, prefer: "EMPLOYEE" | "SUPPLIER" | null, raw = text): OwnerMatch | null => (text.trim() ? matchOwner(text, people, companies, prefer, raw) : null);

  type Owner = { key: string; label: string; match: OwnerMatch; ai?: PlacementIssue["ai"]; newWorker?: { name: string; passportNumber: string; emiratesId: string; trade: string } };
  const owners = new Map<string, Owner>();
  const docsOut: { docKey: string; index: number; fileName: string; type: string; expiry: string; confidence: Confidence; pages: number[]; ownerKey: string | null; via: Via | null; conflict: boolean; status: "ok" | "skip"; reason?: string; readByAi: boolean }[] = [];

  for (const f of files) {
    const fileName = f.path.replace(/\\/g, "/").split("/").pop() ?? f.path;
    const ext = extOf(fileName);
    if (fileName.startsWith(".") || /^(thumbs\.db|desktop\.ini)$/i.test(fileName) || f.path.includes("__MACOSX")) continue;
    if (!MIME_BY_EXT[ext]) { docsOut.push({ docKey: `${f.index}`, index: f.index, fileName, type: "OTHER", expiry: "", confidence: "low", pages: [], ownerKey: null, via: null, conflict: false, status: "skip", reason: `${ext ? `.${ext}` : "This"} isn't a supported file type.`, readByAi: false }); continue; }
    const hint = readPath(f.path, commonRoot);
    const units: DocIn[] = f.docs?.length ? f.docs : [{ docKey: `${f.index}`, type: hint.type?.type ?? "OTHER", holder: "", idNumber: "", expiry: "", confidence: "low", pages: [] }];
    const readByAi = !!f.docs?.length;
    for (const u of units) {
      const type = validTypes.has(u.type) ? u.type : "OTHER";
      let ownerKey: string | null = null;
      let via: Via | null = null;
      let conflict = false;
      let match: OwnerMatch | null = null;
      const numId = readByAi ? byNumber(type, u.idNumber) : null;
      const hintMatch = hint.owner ? nameMatch(hint.owner.text, hint.type?.owner ?? null, hint.owner.raw) : null;
      const holderMatch = readByAi && u.holder ? nameMatch(u.holder, null) : null;
      if (numId) {
        const rec = recs.get(numId)!;
        match = { status: "matched", kind, id: numId, name: String(rec.name), how: "name" };
        via = "number";
        if (hintMatch?.status === "matched" && hintMatch.id !== numId) conflict = true;
      } else if (holderMatch?.status === "matched" && holderMatch.kind === kind) {
        match = holderMatch; via = "name";
        if (hintMatch?.status === "matched" && hintMatch.id !== holderMatch.id) conflict = true;
      } else if (hintMatch?.status === "matched" && hintMatch.kind === kind) {
        match = hintMatch; via = "folder or file name";
      } else {
        const lead = holderMatch && holderMatch.status !== "unknown" ? holderMatch : hintMatch && hintMatch.status !== "unknown" ? hintMatch : holderMatch ?? hintMatch;
        const label = (u.holder || hint.owner?.text || "").trim();
        if (lead && label) {
          match = lead;
          const key = `N:${exactKey(label) || idKey(u.idNumber)}`;
          ownerKey = key;
          if (!owners.has(key)) owners.set(key, { key, label, match: lead });
        }
      }
      if (match?.status === "matched") {
        ownerKey = `${kind === "EMPLOYEE" ? "E" : "S"}:${match.id}`;
        if (!owners.has(ownerKey)) owners.set(ownerKey, { key: ownerKey, label: match.name, match });
      }
      docsOut.push({ docKey: u.docKey, index: f.index, fileName, type, expiry: u.expiry, confidence: u.confidence, pages: u.pages, ownerKey, via, conflict, status: "ok", readByAi });
      // What a "new worker" would be created with, built from what the AI read.
      if (ownerKey?.startsWith("N:") && audience === "EMPLOYEE" && readByAi && u.holder) {
        const o = owners.get(ownerKey)!;
        o.newWorker ??= { name: u.holder || o.label, passportNumber: "", emiratesId: "", trade: "" };
        if (!o.newWorker.name && u.holder) o.newWorker.name = u.holder;
        if (type === "PASSPORT" && u.idNumber) o.newWorker.passportNumber ||= u.idNumber;
        if (type === "EMIRATES_ID" && u.idNumber) o.newWorker.emiratesId ||= u.idNumber;
      }
    }
  }

  // A close or shared name gets the assistant's opinion (workers only; it picks from the shortlist).
  const list = [...owners.values()];
  const issues: PlacementIssue[] = list
    .filter((o) => o.match.status === "close" || o.match.status === "several")
    .map((o) => ({
      key: o.key, fileName: o.label, rows: [], camp: "", room: "", kind: o.match.status as "close" | "several",
      candidates: (o.match as Extract<OwnerMatch, { candidates: unknown }>).candidates.filter((c) => c.kind === "EMPLOYEE").map((c) => ({ id: c.id, name: c.name, code: c.sub.split(" · ")[0] ?? "", trade: null, supplier: null, housed: null, score: c.score })),
    }))
    .filter((i) => i.candidates.length > 0);
  if (issues.length) for (const i of await suggestWorkerMatches(issues)) { const o = owners.get(i.key); if (o && i.ai) o.ai = i.ai; }

  return NextResponse.json({
    audience,
    owners: list,
    docs: docsOut,
    types: typeOptions,
    pickList: audience === "EMPLOYEE"
      ? { employees: people.slice(0, 5000).map((p) => ({ id: p.id, label: `${p.name} (${p.code})`, name: p.name, photo: photos.has(p.id) })), suppliers: [] }
      : { employees: [], suppliers: companies.map((s) => ({ id: s.id, label: s.name })) },
    maxFileBytes: MAX_BULK_FILE_BYTES,
  });
}
