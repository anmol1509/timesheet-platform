import { splitDayHours } from "@/lib/payroll";

/**
 * RKG's time card: a pre-printed 115 x 220 mm card with the worker's details at the top, a grid of the month's days
 * (1 to 16 on the left, 17 to 31 on the right, each with IN, OUT, OVERTIME and TOTAL), a totals box and three signature lines.
 *
 * The positions below were measured from a scan of the real card, so what the app prints lands in the card's own boxes.
 * Three ways of printing share them: on top of the artwork uploaded from the card, on top of the physical card (values only),
 * or on a plain sheet with the card drawn by the app from the editable template.
 */

export const CARD_WIDTH_MM = 115;
export const CARD_HEIGHT_MM = 220;

// ---- Measured positions ------------------------------------------------------------------
// Taken in pixels from a 300 dpi scan of the card (11.81 px per mm) and converted to millimetres from the card's top-left.
const PX = 11.81;
const SCAN_X = 115 / 115.68; // the scan is within 1% of the real size
const SCAN_Y = 220 / 221.1;
const mmX = (px: number) => Math.round((px / PX) * SCAN_X * 100) / 100;
const mmY = (px: number) => Math.round((px / PX) * SCAN_Y * 100) / 100;

/** A field in the header: where its value goes (x from/to, and the dotted line it sits on). */
export type HeaderField = { x: number; w: number; line: number };
const field = (x0: number, x1: number, line: number): HeaderField => ({ x: mmX(x0), w: mmX(x1) - mmX(x0), line: mmY(line) });

export const GEOM = {
  fields: {
    name: field(164, 947, 449),
    date: field(1046, 1313, 449),
    profession: field(262, 780, 527),
    site: field(880, 1313, 527),
    wage: field(668, 1055, 601),
    no: field(1124, 1313, 601),
  },
  /** The label of each header field sits in front of its value, from here. */
  labelX: { name: mmX(56), date: mmX(953), profession: mmX(56), site: mmX(794), wage: mmX(56), no: mmX(1061) },
  headerTop: mmY(79),
  rule: mmY(238),
  titlePill: { x: mmX(542), y: mmY(309), w: mmX(818) - mmX(542), h: mmY(357) - mmY(309) },
  grid: {
    headY: [mmY(629), mmY(692)] as [number, number],
    rowsY: [692, 787, 862, 936, 1011, 1085, 1160, 1234, 1308, 1383, 1457, 1532, 1606, 1680, 1754, 1829, 1908].map(mmY),
    left: [58, 152, 286, 416, 546, 678].map(mmX),
    right: [685, 778, 911, 1044, 1174, 1318].map(mmX),
  },
  totals: {
    headY: [mmY(1918), mmY(1968)] as [number, number],
    rowsY: [1968, 2038, 2114, 2188, 2264, 2338].map(mmY),
    cols: [56, 418, 548, 780, 915, 1318].map(mmX),
  },
  signatures: {
    lineY: mmY(2466),
    labelY: mmY(2500),
    x: [[62, 422], [500, 872], [947, 1313]].map(([a, b]) => [mmX(a), mmX(b)] as [number, number]),
  },
} as const;

// ---- The editable template ---------------------------------------------------------------
export type TimeCardSpec = {
  /** Printed shift on working days when the card is filled in, e.g. 07:00 and 16:00. */
  shiftIn: string;
  shiftOut: string;
  /** Moves everything printed on the physical card, in mm, to line up the printer (right and down are positive). */
  offsetXmm: number;
  offsetYmm: number;
  // The card the app draws itself (third option).
  showLogo: boolean;
  /** Blank means the company name from the company profile. */
  companyName: string;
  /** Blank means the address, phone and email from the company profile. */
  contactLine: string;
  title: string;
  labels: { name: string; date: string; profession: string; site: string; wage: string; no: string };
  headings: { date: string; in: string; out: string; overtime: string; total: string };
  totals: { header: string; days: string; overtime: string; earned: string; advance: string; balance: string };
  signatures: [string, string, string];
  ink: string;
  tint: string;
};

export const DEFAULT_SPEC: TimeCardSpec = {
  shiftIn: "07:00",
  shiftOut: "16:00",
  offsetXmm: 0,
  offsetYmm: 0,
  showLogo: true,
  companyName: "",
  contactLine: "",
  title: "TIME CARD",
  labels: { name: "Name", date: "Date", profession: "Profession", site: "Site", wage: "Daily wages/Hourly/Monthly Dhms", no: "No." },
  headings: { date: "DATE", in: "IN", out: "OUT", overtime: "OVERTIME", total: "TOTAL" },
  totals: { header: "AMOUNT", days: "Total working days/hours", overtime: "Overtime", earned: "Total Amount Earned", advance: "Less Advance", balance: "Balance" },
  signatures: ["Employee Signature", "Foreman Signature", "Manager Signature"],
  ink: "#2A507C",
  tint: "#B4E8D7",
};

const text = (v: unknown, max: number, fallback: string) => (typeof v === "string" ? v.trim().slice(0, max) : fallback);
const colour = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback);
const time = (v: unknown, fallback: string) => (typeof v === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v.trim()) ? v.trim() : fallback);
const mm = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.min(15, Math.max(-15, Math.round(n * 10) / 10)) : 0; };

/** The saved template, whatever shape it is in, made safe: unknown keys dropped, texts trimmed and limited, blanks replaced by the defaults. */
export function readTimeCardSpec(raw: unknown): TimeCardSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const group = (k: string) => (r[k] && typeof r[k] === "object" ? (r[k] as Record<string, unknown>) : {});
  const d = DEFAULT_SPEC;
  const pick = <T extends Record<string, string>>(k: string, base: T, max: number): T => {
    const g = group(k);
    return Object.fromEntries(Object.entries(base).map(([key, def]) => [key, text(g[key], max, def) || def])) as T;
  };
  const sigs = Array.isArray(r.signatures) ? r.signatures : [];
  return {
    shiftIn: time(r.shiftIn, d.shiftIn),
    shiftOut: time(r.shiftOut, d.shiftOut),
    offsetXmm: mm(r.offsetXmm),
    offsetYmm: mm(r.offsetYmm),
    showLogo: r.showLogo === undefined ? d.showLogo : r.showLogo === true,
    companyName: text(r.companyName, 80, ""),
    contactLine: text(r.contactLine, 160, ""),
    title: text(r.title, 30, d.title) || d.title,
    labels: pick("labels", d.labels, 40),
    headings: pick("headings", d.headings, 12),
    totals: pick("totals", d.totals, 36),
    signatures: [0, 1, 2].map((i) => text(sigs[i], 30, d.signatures[i]) || d.signatures[i]) as [string, string, string],
    ink: colour(r.ink, d.ink),
    tint: colour(r.tint, d.tint),
  };
}

// ---- One worker's card -------------------------------------------------------------------
/** A day on the card: what to print in each box ("" leaves it blank). */
export type CardDay = { day: number; in: string; out: string; overtime: string; total: string };

export type CardWorker = {
  /** The own company whose card this is: the worker's employer if it is one of ours, else the company that sponsors their visa; null for neither. */
  companyId: string | null;
  companyName: string;
  name: string;
  idNo: string;
  profession: string;
  site: string;
  /** "Oct 2026" */
  monthLabel: string;
  /** Pay rate for the wage line; only filled when pay is shown. */
  wage: string;
  days: CardDay[];
  totals: { days: number; hours: string; overtimeHours: string };
  /** AED figures from the payroll run for the month; null where there is no run or pay is not shown. */
  money: { basic: string; overtime: string; earned: string; advance: string; balance: string } | null;
};

/** One day's raw record: hours with an optional status, from the timesheet or attendance. */
export type RawDay = { date: string; status: "PRESENT" | "ABSENT" | "OFF" | "OTHER"; normalHours: number | null; otHours: number | null };

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * The card's day boxes for a month from the worker's raw days, using the same split into normal and overtime hours as payroll:
 * hours beyond the standard day are overtime, and everything worked on a weekly off day or holiday is overtime.
 * `inOut: "standard"` prints the shift times on days worked; "blank" leaves IN and OUT for the foreman to write.
 */
export function buildCardDays(opts: { month: string; days: RawDay[]; dailyHours: number; weeklyOffDays: number[]; inOut: "blank" | "standard"; shiftIn: string; shiftOut: string }): { days: CardDay[]; totals: CardWorker["totals"] } {
  const [y, m] = opts.month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDate = new Map(opts.days.map((d) => [d.date, d]));
  const out: CardDay[] = [];
  let worked = 0, normal = 0, overtime = 0;
  for (let day = 1; day <= count; day++) {
    const date = `${opts.month}-${String(day).padStart(2, "0")}`;
    const raw = byDate.get(date);
    const when = new Date(Date.UTC(y, m - 1, day));
    const cell: CardDay = { day, in: "", out: "", overtime: "", total: "" };
    if (!raw) { out.push(cell); continue; }
    if (raw.status === "ABSENT") { cell.total = "A"; out.push(cell); continue; }
    if (raw.status === "OFF") { cell.total = "OFF"; out.push(cell); continue; }
    const split = splitDayHours({ date: when, status: raw.status === "PRESENT" ? "PRESENT" : "LEAVE", normalHours: raw.normalHours, otHours: raw.otHours }, { dailyHours: opts.dailyHours, weeklyOffDays: opts.weeklyOffDays });
    const total = (raw.normalHours ?? 0) + (raw.otHours ?? 0);
    if (total <= 0) { out.push(cell); continue; }
    const ot = split.ot + split.rest;
    cell.total = fmt(total);
    if (ot > 0) cell.overtime = fmt(ot);
    if (opts.inOut === "standard") { cell.in = opts.shiftIn; cell.out = opts.shiftOut; }
    worked += 1; normal += split.normal; overtime += ot;
    out.push(cell);
  }
  return { days: out, totals: { days: worked, hours: fmt(normal), overtimeHours: fmt(overtime) } };
}

/** Day number printed in a grid row: rows run 1 to 16 down the left half and 17 to 31 down the right. */
export const dayOfRow = (half: 0 | 1, row: number) => (half === 0 ? row + 1 : row + 17);

/** The own company a worker's card belongs to: their employer if it is one of ours, else their visa sponsor if it is, else none. */
export function cardCompanyOf(e: { supplier?: { id: string; isOwnCompany: boolean } | null; sponsorSupplier?: { id: string; isOwnCompany: boolean } | null }): string | null {
  if (e.supplier?.isOwnCompany) return e.supplier.id;
  if (e.sponsorSupplier?.isOwnCompany) return e.sponsorSupplier.id;
  return null;
}
