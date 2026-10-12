import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { SAMPLE_MARK } from "@/lib/getStarted";
import { analyzeBatch, createBatch, previewBatch, runBatch, undoBatch, type BatchUser } from "./engine";
import type { ImportKind } from "./types";

// A small, obviously-fake company so someone can look around before moving
// their own data in. It goes through the same import engine as real data and is
// flagged, so it can be removed with one click (an undo of those imports).

const TAG = "(Sample)";
const NAMES = ["Ravi Kumar", "Suresh Yadav", "Mohammed Rafiq", "Bikash Thapa", "Arjun Rai", "Imran Ali", "Rahim Uddin", "Jose Santos", "Karim Hossain", "Deepak Shrestha", "Nadeem Akhtar", "Sunil Gurung", "Faisal Mahmood", "Anil Tamang", "Romeo Reyes", "Sohel Rana", "Vijay Singh", "Tarek Aziz", "Prakash Magar", "Zahid Hussain", "Mark Villanueva", "Habib Khan", "Ramesh Karki", "Jamal Ahmed"];
const TRADES = ["Carpenter", "Steel Fixer", "Mason", "Electrician", "Plumber", "Painter", "Helper", "Welder"];
const COUNTRIES = ["India", "Nepal", "Pakistan", "Bangladesh", "Philippines", "India", "Nepal", "Pakistan"];
const SITES = ["Tower A", "Marina Block 3", "Villa Cluster", "Mall Extension"];

const csv = (rows: string[][]) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
const dmy = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

export function buildSampleFiles(branchCode: string, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const suppliers = [`Gulf Star Manpower ${TAG}`, `Desert Rose Contracting ${TAG}`, `Blue Wave Labour Supply ${TAG}`];
  const subSupplier = `Gulf Star Site Services ${TAG}`;
  const clients = [`Skyline Developments ${TAG}`, `Marina Builders ${TAG}`, `Oasis Facilities ${TAG}`];

  const supplierCsv = csv([
    ["Supplier name", "Parent supplier", "Contact person", "Contact phone", "Contact email", "Category"],
    [suppliers[0], "", "Rashid Al Mansoori", "+971 50 000 0001", "rashid@sample.example", "Manpower supply"],
    [subSupplier, suppliers[0], "", "", "", "Manpower supply"],
    [suppliers[1], "", "Priya Nair", "+971 50 000 0002", "priya@sample.example", "Contracting"],
    [suppliers[2], "", "Mohammed Farooq", "+971 50 000 0003", "farooq@sample.example", "Manpower supply"],
  ]);
  const clientCsv = csv([
    ["Company name", "Contact person", "Contact phone", "Contact email", "Payment terms"],
    [clients[0], "Sara Ahmed", "+971 4 000 0101", "sara@sample.example", "30 days"],
    [clients[1], "John Mathew", "+971 4 000 0102", "john@sample.example", "45 days"],
    [clients[2], "Layla Hassan", "+971 4 000 0103", "layla@sample.example", "30 days"],
  ]);

  const workers = NAMES.map((name, i) => {
    // The main supplier supplies the worker; the sponsor (visa company) is the sub-company for some.
    const supplier = i % 4 === 3 ? suppliers[0] : suppliers[i % 3];
    const sponsor = i % 4 === 3 ? subSupplier : supplier;
    // a spread of document dates so the compliance views have something to show
    const eid = addDays(today, [400, 25, -10, 200, 12, 300, 90, 520][i % 8]);
    const visa = addDays(today, [365, 40, 5, 150, -20, 280, 60, 480][i % 8]);
    return [
      `SMP-${branchCode}-${String(i + 1).padStart(2, "0")}`, name, TRADES[i % TRADES.length], supplier, sponsor, COUNTRIES[i % COUNTRIES.length],
      `+971 50 ${String(100 + i).padStart(3, "0")} ${String(1000 + i * 7).slice(0, 4)}`, "Male", dmy(addDays(today, -365 * (24 + (i % 15)))), dmy(addDays(today, -200 - i * 20)),
      `SP${1000000 + i * 131}`, dmy(addDays(today, 900 - i * 11)), dmy(eid), dmy(visa),
    ];
  });
  const workerCsv = csv([
    ["Employee code", "Worker name", "Trade", "Supplier", "Sponsor", "Nationality", "Mobile number", "Gender", "Date of birth", "Joining date", "Passport number", "Passport expiry", "Emirates ID expiry", "Visa expiry"],
    ...workers,
  ]);
  return { supplierCsv, clientCsv, workerCsv, workers, clients, now: today };
}

export async function buildSampleTimesheet(workers: string[][], clients: string[], today: Date): Promise<Buffer> {
  const year = today.getUTCFullYear(), month = today.getUTCMonth();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const name = `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month]} ${String(year).slice(2)}`;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(name);
  const lead = ["S. N.", "I. D. No", "EMPLOYEE NAME", "Nationality", "Sponsor", "Main Supplier", "Client Name", "Site", "TRADE", "Rate", "TOTAL"];
  ws.addRow([...lead, ...Array.from({ length: days }, () => "")]);
  ws.addRow([...lead.map(() => ""), ...Array.from({ length: days }, (_, d) => new Date(Date.UTC(year, month, d + 1)))]);
  const rand = rng(7);
  workers.forEach((w, i) => {
    const [id, wname, trade, supplier, sponsor, nationality] = w;
    const cells = Array.from({ length: days }, (_, d) => {
      const date = new Date(Date.UTC(year, month, d + 1));
      if (date > today) return "";
      if (date.getUTCDay() === 5) return "OFF"; // Friday
      const r = rand();
      if (r < 0.04) return "A";
      if (r < 0.06) return "SL";
      return 9 + Math.floor(rand() * 3); // 9-11 hours
    });
    ws.addRow([i + 1, id, wname, nationality, sponsor, supplier, clients[i % clients.length], SITES[i % SITES.length], trade, [10, 11, 9, 12, 10.5, 9.5, 10, 11][i % 8], "", ...cells]);
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function sampleState(branchId: string) {
  const batches = await prisma.importBatch.findMany({
    where: { branchId, status: "DONE", options: { contains: SAMPLE_MARK } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return { loaded: batches.length > 0, batchIds: batches.map((b) => b.id) };
}

/** Load the sample company. Everything goes through the import engine, so it is recorded and removable. */
export async function loadSample(branchId: string, user: BatchUser): Promise<{ counts: Record<string, number> }> {
  if ((await sampleState(branchId)).loaded) throw new Error("The sample company is already loaded.");
  const branch = await prisma.branch.findUniqueOrThrow({ where: { id: branchId }, select: { code: true } });
  const f = buildSampleFiles(branch.code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
  const ts = await buildSampleTimesheet(f.workers, f.clients.map((c) => c), f.now);
  const steps: { kind: ImportKind; name: string; buffer: Buffer }[] = [
    { kind: "SUPPLIERS", name: "sample-suppliers.csv", buffer: Buffer.from(f.supplierCsv) },
    { kind: "CLIENTS", name: "sample-clients.csv", buffer: Buffer.from(f.clientCsv) },
    { kind: "WORKERS", name: "sample-workers.csv", buffer: Buffer.from(f.workerCsv) },
    { kind: "TIMESHEETS", name: "sample-timesheet.xlsx", buffer: ts },
  ];
  const done: string[] = [];
  const counts: Record<string, number> = {};
  try {
    for (const s of steps) {
      const b = await createBatch({ kind: s.kind, filename: s.name, buffer: s.buffer, branchId, userId: user.id, options: { sample: true } });
      const a = await analyzeBatch(b.id);
      const mapping = a.kind === "TIMESHEETS" ? { columns: {} } : { sheet: a.sheet, headerRow: a.headerRow, columns: a.columns };
      const pv = await previewBatch(b.id, user, mapping);
      if ((pv.counts.failed ?? 0) > 0) throw new Error(`The sample ${s.kind.toLowerCase()} didn't import cleanly.`);
      await runBatch(b.id, user);
      const after = await prisma.importBatch.findUniqueOrThrow({ where: { id: b.id }, select: { status: true, error: true } });
      if (after.status !== "DONE") throw new Error(after.error ?? "The sample didn't finish importing.");
      done.push(b.id);
      counts[s.kind] = pv.counts.created ?? 0;
    }
  } catch (e) {
    for (const id of done.reverse()) await undoBatch(id).catch(() => undefined);
    throw e;
  }
  return { counts };
}

/** Remove the sample company: undo its imports, newest first. */
export async function removeSample(branchId: string) {
  const { batchIds } = await sampleState(branchId);
  let kept = 0;
  for (const id of [...batchIds].reverse()) kept += (await undoBatch(id)).kept.length;
  return { removed: batchIds.length, kept };
}
