// Pure (no server imports): working out who a file belongs to and what it is, from its path alone.
import { exactKey, nameSimilarity, rankCandidates } from "./workerMatch";

export type DocOwnerKind = "EMPLOYEE" | "SUPPLIER";
export type DocTypeOption = { value: string; label: string };

export const EMPLOYEE_DOC_TYPES: DocTypeOption[] = [
  { value: "PASSPORT", label: "Passport" },
  { value: "EMIRATES_ID", label: "Emirates ID" },
  { value: "VISA", label: "Visa" },
  { value: "LABOR_CARD", label: "Labour card" },
  { value: "RESIDENCY_ISSUANCE", label: "Residency & identity issuance" },
  { value: "MEDICAL", label: "Medical certificate" },
  { value: "CICPA", label: "CICPA" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "DRIVING_LICENCE", label: "Driving licence" },
  { value: "OTHER", label: "Other" },
];
export const SUPPLIER_DOC_TYPE_OPTIONS: DocTypeOption[] = [
  { value: "TRADE_LICENSE", label: "Trade licence" },
  { value: "MOHRE_PERMIT", label: "MOHRE permit" },
  { value: "WORKMEN_COMPENSATION_INSURANCE", label: "Workmen compensation insurance" },
  { value: "ESTABLISHMENT_CARD", label: "MOHRE establishment card" },
  { value: "EJARI_TENANCY", label: "Ejari / tenancy contract" },
  { value: "CHAMBER_OF_COMMERCE", label: "Chamber of commerce certificate" },
  { value: "TRN_CERTIFICATE", label: "VAT / TRN certificate" },
  { value: "CONTRACT", label: "Contract" },
  { value: "OTHER", label: "Other" },
];

type Rule = { type: string; owner: DocOwnerKind | null; re: RegExp };
// Order matters: the more specific wording first.
const RULES: Rule[] = [
  { type: "TRADE_LICENSE", owner: "SUPPLIER", re: /\b(trade|commercial|business)\s*licen[cs]e\b|\btl\b/i },
  { type: "MOHRE_PERMIT", owner: "SUPPLIER", re: /\bmohre\s*permit\b|\bpermit\b/i },
  { type: "WORKMEN_COMPENSATION_INSURANCE", owner: "SUPPLIER", re: /\bworkmen\b|\bwc\s*insurance\b|\bcompensation\b/i },
  { type: "ESTABLISHMENT_CARD", owner: "SUPPLIER", re: /\bestablishment\b/i },
  { type: "EJARI_TENANCY", owner: "SUPPLIER", re: /\bejari\b|\btenancy\b/i },
  { type: "CHAMBER_OF_COMMERCE", owner: "SUPPLIER", re: /\bchamber\b/i },
  { type: "TRN_CERTIFICATE", owner: "SUPPLIER", re: /\btrn\b|\bvat\b/i },
  { type: "CONTRACT", owner: "SUPPLIER", re: /\bcontract\b|\bagreement\b/i },
  { type: "EMIRATES_ID", owner: "EMPLOYEE", re: /\bemirates\s*id\b|\be\s*id\b|\beid\b|\bnational\s*id\b/i },
  { type: "PASSPORT", owner: "EMPLOYEE", re: /\bpassport\b|\bpp\b/i },
  { type: "LABOR_CARD", owner: "EMPLOYEE", re: /\blab(?:ou?r)\s*card\b|\bwork\s*permit\b|\bmohre\s*card\b/i },
  { type: "RESIDENCY_ISSUANCE", owner: "EMPLOYEE", re: /\bresidency\b|\bissuance\b/i },
  { type: "VISA", owner: "EMPLOYEE", re: /\bvisa\b|\bresidence\b/i },
  { type: "MEDICAL", owner: "EMPLOYEE", re: /\bmedical\b|\bfitness\b/i },
  { type: "CICPA", owner: "EMPLOYEE", re: /\bcicpa\b/i },
  { type: "DRIVING_LICENCE", owner: "EMPLOYEE", re: /\bdriv(?:ing|er)s?\s*licen[cs]e\b|\bdl\b/i },
  { type: "INSURANCE", owner: null, re: /\binsurance\b/i },
];
const NOISE = /\b(front|back|page|pg|copy|scan(?:ned)?|image|img|photo|pic|doc(?:ument)?|new|old|final|file|pdf|jpe?g|png|exp(?:iry)?|of|and)\b|\b\d{1,3}\b|\(\d+\)/gi;

const norm = (s: string) => s.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();

/** What a file name says about the type (and whether that type only exists for suppliers). */
export function guessDocType(text: string): { type: string; owner: DocOwnerKind | null; hit: string } | null {
  const t = norm(text);
  for (const r of RULES) {
    const m = t.match(r.re);
    if (m) return { type: r.type, owner: r.owner, hit: m[0] };
  }
  return null;
}

export type FileEntry = { index: number; path: string };
/** `raw` keeps codes such as AN-101 intact; `text` is the cleaned-up name. */
export type OwnerText = { text: string; raw: string; fromFolder: boolean };

/** Splits "Ravi Kumar/passport.pdf" or "Ravi Kumar - Passport.pdf" into the owner text and the type. */
export function readPath(path: string, commonRoot = ""): { owner: OwnerText | null; fileText: string; type: ReturnType<typeof guessDocType> } {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  const file = parts.pop() ?? "";
  const folders = parts.filter((f, i) => !(i === 0 && commonRoot && f === commonRoot) && !/^(__macosx|documents?|files?|scans?|uploads?|employees?|suppliers?|workers?)$/i.test(f));
  const base = file.replace(/\.[a-z0-9]{2,5}$/i, "");
  const type = guessDocType(base) ?? (folders.length ? guessDocType(folders[folders.length - 1]) : null);
  if (folders.length) return { owner: { text: norm(folders[folders.length - 1]), raw: norm(folders[folders.length - 1]), fromFolder: true }, fileText: base, type: guessDocType(base) };
  let rest = norm(base);
  if (type) rest = rest.replace(type.hit, " ");
  const raw = rest.replace(/\s[-–—|]+\s/g, " ").replace(/[,:;()[\]]+/g, " ").replace(/\s+/g, " ").trim();
  // A code like AN-101 is left whole; only stray separators and page numbers are dropped.
  rest = rest.replace(/[-–—|,:;()[\]]+/g, " ").replace(NOISE, " ").replace(/\s+/g, " ").trim();
  return { owner: rest ? { text: rest, raw, fromFolder: false } : null, fileText: base, type };
}

export type Person = { id: string; name: string; code: string; trade?: string | null; supplier?: string | null };
export type Company = { id: string; name: string; code?: string | null; fullName?: string | null };

export type OwnerMatch =
  | { status: "matched"; kind: DocOwnerKind; id: string; name: string; how: "code" | "name" | "close" }
  | { status: "several" | "close" | "unknown"; candidates: { kind: DocOwnerKind; id: string; name: string; sub: string; score: number }[] };

/** Who a typed owner name means: exact code, exact name, or a close spelling, among workers and suppliers. */
export function matchOwner(text: string, people: Person[], companies: Company[], prefer: DocOwnerKind | null = null, raw = text): OwnerMatch {
  const key = exactKey(text);
  const byCode = people.filter((p) => exactKey(p.code) === key);
  if (byCode.length === 1 && key) return { status: "matched", kind: "EMPLOYEE", id: byCode[0].id, name: byCode[0].name, how: "code" };
  // A code in the text, next to the name ("AN-101 Ravi Kumar").
  for (const tok of raw.split(/\s+/)) {
    const hit = people.filter((p) => p.code && exactKey(p.code) === exactKey(tok));
    if (hit.length === 1 && exactKey(tok).length >= 3) return { status: "matched", kind: "EMPLOYEE", id: hit[0].id, name: hit[0].name, how: "code" };
  }
  const nameKeyOf = (c: Company) => [c.name, c.fullName].filter(Boolean).map((n) => exactKey(n as string));
  const peopleExact = people.filter((p) => exactKey(p.name) === key);
  const cosExact = companies.filter((c) => nameKeyOf(c).includes(key));
  if (prefer === "SUPPLIER" && cosExact.length === 1) return { status: "matched", kind: "SUPPLIER", id: cosExact[0].id, name: cosExact[0].name, how: "name" };
  if (peopleExact.length + cosExact.length === 1) {
    return peopleExact.length ? { status: "matched", kind: "EMPLOYEE", id: peopleExact[0].id, name: peopleExact[0].name, how: "name" } : { status: "matched", kind: "SUPPLIER", id: cosExact[0].id, name: cosExact[0].name, how: "name" };
  }
  const cand = (kind: DocOwnerKind, id: string, name: string, sub: string, score: number) => ({ kind, id, name, sub, score: Math.round(score * 100) / 100 });
  if (peopleExact.length + cosExact.length > 1) {
    return { status: "several", candidates: [...peopleExact.map((p) => cand("EMPLOYEE", p.id, p.name, [p.code, p.trade, p.supplier].filter(Boolean).join(" · "), 1)), ...cosExact.map((c) => cand("SUPPLIER", c.id, c.name, "Supplier", 1))] };
  }
  const close = [
    ...rankCandidates(text, people.map((p) => ({ id: p.id, name: p.name, employeeIdNo: p.code, trade: p.trade, supplier: p.supplier })), 5, 0.78).map((p) => cand("EMPLOYEE", p.id, p.name, [p.employeeIdNo, p.trade, p.supplier].filter(Boolean).join(" · "), p.score)),
    ...companies.map((c) => ({ c, s: Math.max(...[c.name, c.fullName].filter(Boolean).map((n) => nameSimilarity(text, n as string))) })).filter((x) => x.s >= 0.8).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => cand("SUPPLIER", x.c.id, x.c.name, "Supplier", x.s)),
  ].sort((a, b) => b.score - a.score).slice(0, 6);
  return { status: close.length ? "close" : "unknown", candidates: close };
}

/** The accepted file kinds, by extension (zip entries carry no content type). */
export const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export const extOf = (name: string) => (name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "").toLowerCase();
