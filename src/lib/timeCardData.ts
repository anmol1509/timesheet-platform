import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { PAY_EMPLOYEE_SELECT, hourlyRateSource } from "@/lib/payrollRun";
import { parseDailyHours } from "@/lib/timesheetCells";
import { buildCardDays, cardCompanyOf, readTimeCardSpec, type CardWorker, type RawDay, type TimeCardSpec } from "@/lib/timeCard";
import { buildLetterhead, imageIsReadable, type Letterhead } from "@/lib/letterhead";

const num = (d: { toString(): string } | null | undefined) => (d == null ? 0 : Number(d.toString()));
const aed = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthLabel = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The timesheet's days for a worker as raw days: hours added up across the month's sheets (a worker can have one per trade),
 * "A" for absent and "OFF" for a day off.
 */
export function rawDaysFromSheets(sheets: { dailyHours: string | null }[]): RawDay[] {
  const byDate = new Map<string, { hours: number; absent: boolean; off: boolean }>();
  for (const sheet of sheets) {
    for (const cell of parseDailyHours(sheet.dailyHours ?? "")) {
      if (!cell.date) continue;
      const row = byDate.get(cell.date) ?? { hours: 0, absent: false, off: false };
      const v = String(cell.value ?? "").trim().toUpperCase();
      const n = Number(v);
      if (v && Number.isFinite(n)) row.hours += n;
      else if (v === "A") row.absent = true;
      else if (v === "OFF") row.off = true;
      byDate.set(cell.date, row);
    }
  }
  return [...byDate.entries()].map(([date, r]) => ({
    date,
    status: r.hours > 0 ? ("PRESENT" as const) : r.absent ? ("ABSENT" as const) : r.off ? ("OFF" as const) : ("OTHER" as const),
    normalHours: r.hours > 0 ? r.hours : null,
    otHours: null,
  }));
}

/** Attendance rows as raw days. */
export function rawDaysFromAttendance(rows: { date: Date; status: string; normalHours: number | null; otHours: number | null }[]): RawDay[] {
  return rows.map((a) => ({
    date: a.date.toISOString().slice(0, 10),
    status: a.status === "PRESENT" ? "PRESENT" : a.status === "ABSENT" ? "ABSENT" : a.status === "OFF" || a.status === "HOLIDAY" ? "OFF" : "OTHER",
    normalHours: a.normalHours,
    otHours: a.otHours,
  }));
}

/**
 * The cards for the workers with these ID numbers for a month. `filled` false makes cards with only the header (name, month,
 * profession, site, number) for the foreman to fill in by hand. Pay (the wage line and the totals box) is only included when
 * `showPay` is true, and the totals box only where a payroll run for the month exists.
 */
export async function loadCardWorkers(opts: {
  branchId: string | null;
  idNos: string[];
  month: string;
  filled: boolean;
  inOut: "blank" | "standard";
  showPay: boolean;
}): Promise<CardWorker[]> {
  const { branchId, idNos, month } = opts;
  if (idNos.length === 0) return [];
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const employees = await prisma.employee.findMany({
    where: { ...branchWhere(branchId), employeeIdNo: { in: idNos } },
    select: { ...PAY_EMPLOYEE_SELECT, supplier: { select: { id: true, name: true, fullName: true, isOwnCompany: true } }, sponsorSupplier: { select: { id: true, name: true, fullName: true, isOwnCompany: true } }, skills: { select: { rate: true, isActive: true, skill: { select: { name: true } } } }, project: { select: { name: true, weeklyOffDays: true } }, payStructure: true, basicSalary: true, housingAllowance: true, foodAllowance: true, transportAllowance: true },
  });
  const order = new Map(idNos.map((id, i) => [id, i]));
  employees.sort((a, b) => (order.get(a.employeeIdNo) ?? 0) - (order.get(b.employeeIdNo) ?? 0));
  const ids = employees.map((e) => e.id);
  const idNoList = employees.map((e) => e.employeeIdNo);

  const [sheets, attendance, lines] = await Promise.all([
    opts.filled ? prisma.timesheetEntry.findMany({ where: { ...branchWhere(branchId), month, employeeIdNo: { in: idNoList } }, select: { employeeIdNo: true, dailyHours: true, site: true } }) : [],
    opts.filled ? prisma.attendance.findMany({ where: { employeeId: { in: ids }, date: { gte: start, lt: next } }, select: { employeeId: true, date: true, status: true, normalHours: true, otHours: true } }) : [],
    opts.showPay ? prisma.payrollLine.findMany({ where: { employeeId: { in: ids }, run: { month, ...branchWhere(branchId) } }, orderBy: { run: { createdAt: "desc" } }, select: { employeeId: true, basic: true, allowances: true, overtimePay: true, loanDeduction: true, net: true } }) : [],
  ]);
  const lineOf = new Map<string, (typeof lines)[number]>();
  for (const l of lines) if (!lineOf.has(l.employeeId)) lineOf.set(l.employeeId, l);

  return employees.map((e) => {
    const mine = sheets.filter((s) => s.employeeIdNo === e.employeeIdNo);
    const raw = !opts.filled ? [] : mine.length > 0 ? rawDaysFromSheets(mine) : rawDaysFromAttendance(attendance.filter((a) => a.employeeId === e.id));
    const built = buildCardDays({ month, days: raw, dailyHours: num(e.dailyHours) || 8, weeklyOffDays: e.project?.weeklyOffDays ?? [0], inOut: opts.inOut });
    let wage = "";
    if (opts.showPay) {
      if (e.payStructure === "HOURLY") { const r = hourlyRateSource(e).rate; wage = r > 0 ? `${aed(r)} / hour` : ""; }
      else if (e.payStructure === "FLAT") wage = num(e.flatMonthlyRate) > 0 ? `${aed(num(e.flatMonthlyRate))} / month` : "";
      else if (e.payStructure === "ITEMISED") wage = `${aed(num(e.basicSalary) + num(e.housingAllowance) + num(e.foodAllowance) + num(e.transportAllowance) + num(e.otherAllowance))} / month`;
    }
    const l = lineOf.get(e.id);
    const fixed = l ? num(l.basic) + num(l.allowances) : 0;
    const companyId = cardCompanyOf(e);
    const company = companyId ? (e.supplier?.id === companyId ? e.supplier : e.sponsorSupplier) : null;
    return {
      companyId,
      companyName: company ? company.fullName || company.name : "",
      name: e.name,
      idNo: e.employeeIdNo,
      profession: e.trade ?? e.position ?? "",
      site: mine.find((s) => s.site)?.site ?? e.project?.name ?? "",
      monthLabel: monthLabel(month),
      wage,
      days: built.days,
      totals: built.totals,
      money: opts.showPay && opts.filled && l
        ? { basic: aed(fixed), overtime: num(l.overtimePay) > 0 ? aed(num(l.overtimePay)) : "", // what was earned after deductions and before the advance, so earned less advance is the balance
        earned: aed(num(l.net) + num(l.loanDeduction)), advance: num(l.loanDeduction) > 0 ? aed(num(l.loanDeduction)) : "", balance: aed(num(l.net)) }
        : null,
    } satisfies CardWorker;
  });
}

/** A made-up worker for the template preview, so the card can be seen filled in without anyone's real data. */
export function sampleCardWorker(month: string): CardWorker {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const raw: RawDay[] = [];
  for (let d = 1; d <= count; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    raw.push(dow === 0 ? { date, status: "OFF", normalHours: null, otHours: null } : d === 9 ? { date, status: "ABSENT", normalHours: null, otHours: null } : { date, status: "PRESENT", normalHours: d % 5 === 0 ? 10 : 8, otHours: null });
  }
  const built = buildCardDays({ month, days: raw, dailyHours: 8, weeklyOffDays: [0], inOut: "standard" });
  return { companyId: null, companyName: "", name: "SAMPLE WORKER", idNo: "ID-0001", profession: "Carpenter", site: "Sample Project", monthLabel: monthLabel(month), wage: "1,500.00 / month", days: built.days, totals: built.totals, money: { basic: "1,700.00", overtime: "156.25", earned: "1,856.25", advance: "100.00", balance: "1,756.25" } };
}

/** One own company's card: the blank pre-printed card from its Documents (when there is a usable one) and the header it prints on the template. */
export type CompanyCard = { id: string; name: string; artwork: string | null; /** A card is on file but is not a JPG or PNG. */ unusable: boolean; letterhead: Letterhead; /** The company's own template when it has one, else the shared one. */ spec: TimeCardSpec; ownTemplate: boolean };

export async function loadCompanyCards(companyIds: string[], wantArtwork: boolean, sharedSpec: TimeCardSpec): Promise<Map<string, CompanyCard>> {
  const ids = [...new Set(companyIds)];
  const out = new Map<string, CompanyCard>();
  if (ids.length === 0) return out;
  const [companies, cards] = await Promise.all([
    prisma.supplier.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, fullName: true, location: true, emirate: true, country: true, contactPhone: true, phone: true, contactEmail: true, poBox: true, trn: true, logoId: true, timeCardSpec: true } }),
    wantArtwork ? prisma.attachment.findMany({ where: { entityType: "SUPPLIER", entityId: { in: ids }, docType: "TIME_CARD" }, orderBy: { uploadedAt: "desc" }, select: { entityId: true, fileData: true, mimeType: true } }) : [],
  ]);
  for (const c of companies) {
    const card = cards.find((a) => a.entityId === c.id);
    const usable = !!card && /^image\/(png|jpe?g)$/i.test(card.mimeType) && imageIsReadable(card.fileData, card.mimeType);
    out.set(c.id, {
      id: c.id,
      name: c.fullName || c.name,
      artwork: usable && card ? `data:${card.mimeType};base64,${Buffer.from(card.fileData).toString("base64")}` : null,
      unusable: !!card && !usable,
      spec: c.timeCardSpec ? readTimeCardSpec(c.timeCardSpec) : sharedSpec,
      ownTemplate: !!c.timeCardSpec,
      letterhead: await buildLetterhead({ name: c.fullName || c.name, address: c.location, emirate: c.emirate, country: c.country, phone: c.contactPhone ?? c.phone, fax: null, email: c.contactEmail, poBox: c.poBox, trn: c.trn, logoId: c.logoId, strictLogo: true }),
    });
  }
  return out;
}
