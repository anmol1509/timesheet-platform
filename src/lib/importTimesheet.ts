import { prisma } from "@/lib/db";
import { uniqueClientCode, uniqueSupplierCode } from "@/lib/entityCode";
import { nameKey } from "@/lib/partyCode";
import { normalizeNationality } from "@/lib/nationality";
import { loadTradeCanon } from "@/lib/canon";
import type { ParsedMonth, SkippedRow } from "@/lib/parseTimesheet";
import { calculateAbsentDeduction } from "@/lib/deductions";
import type { Db } from "@/lib/importer/types";
import { newAttendanceStats, writeAttendanceFromEntry } from "@/lib/importer/attendance";

export type ImportStats = {
  monthsProcessed: { month: string; monthLabel: string; entries: number }[];
  suppliersCreated: number;
  clientsCreated: number;
  entriesCreated: number;
  entriesUpdated: number;
  /** Sponsors placed under the main supplier they work for. */
  subsidiariesLinked?: number;
  rowsSkipped: number;
  skippedRowDetails: SkippedRow[];
  unrecognizedSheets: string[];
  /** Attendance days written from the sheet's daily cells (only when the importer is given a user). */
  attendanceCreated?: number;
  /** Days that already had different attendance, left untouched. */
  attendanceConflicts?: number;
  attendanceLocked?: number;
  attendanceUnrecognised?: number;
  unrecognisedValues?: string[];
  /** Workers whose Nationality cell wasn't a country (e.g. "Asian"), so none was saved. */
  nationalityNotSaved?: number;
  nationalityNotSavedValues?: string[];
  /** Project names in the sheet that match no project, so those rows weren't linked. */
  projectsNotFound?: string[];
  /** Workers given an hourly pay rate from the sheet's Pay Rate column. */
  payRatesSet?: number;
  /** Workers linked to a project from the sheet's Project column. */
  workersLinkedToProject?: number;
};

function normalizeKey(name: string) {
  // Case, dots and spacing differ between sheets ("Cont." / "cont"); they are one company.
  return nameKey(name);
}

export type ImportOptions = {
  /** The database (or a transaction, for a dry run). */
  db?: Db;
  /** Who is importing. When given, each worker's days are also written to attendance. */
  userId?: string;
  progress?: (done: number, total: number) => void | Promise<void>;
};

export async function importParsedMonths(
  months: ParsedMonth[],
  uploadId: string,
  branchId: string,
  projectId: string | null = null,
  opts: ImportOptions = {}
): Promise<ImportStats> {
  const db = opts.db ?? prisma;
  const attendance = newAttendanceStats();
  const totalEntries = months.reduce((n, m) => n + m.entries.length, 0);
  let processed = 0;
  let skippedNationality = 0;
  const skippedNationalityValues = new Set<string>();
  // Matched by name WITHIN this branch only. Loading every tenant's suppliers
  // and clients meant a sheet naming "ABC Manpower" attached its rows to another
  // company's supplier of that name, so they surfaced in that company's supplier
  // sheets and billing.
  const [existingSuppliers, existingClients] = await Promise.all([
    db.supplier.findMany({ where: { branchId } }),
    db.client.findMany({ where: { branchId } }),
  ]);

  // An employee ID is unique across the whole system, and the roster upsert
  // below is keyed on it — so a row carrying another company's ID would
  // rewrite that company's employee. Find which IDs in this upload already
  // belong to a different branch and refuse those rows. IDs are compared
  // ignoring case, and a worker this branch already has keeps its own spelling
  // ("bacc146" in a sheet is the worker stored as "BACC146", not a new one).
  const idKey = (id: string) => id.trim().toUpperCase();
  const rawIds = [...new Set(months.flatMap((m) => m.entries.map((e) => e.employeeIdNo.trim())))];
  const idMatch = rawIds.map((id) => ({ employeeIdNo: { equals: id, mode: "insensitive" as const } }));
  const branchIds = new Map(
    (rawIds.length
      ? await db.employee.findMany({ where: { branchId, OR: idMatch }, select: { employeeIdNo: true } })
      : []
    ).map((e) => [idKey(e.employeeIdNo), e.employeeIdNo])
  );
  const foreignKeys = new Set(
    (rawIds.length
      ? await db.employee.findMany({ where: { NOT: { branchId }, OR: idMatch }, select: { employeeIdNo: true } })
      : []
    ).map((e) => idKey(e.employeeIdNo))
  );
  const firstSpelling = new Map<string, string>();
  for (const m of months) {
    for (const e of m.entries) {
      const k = idKey(e.employeeIdNo);
      e.employeeIdNo = branchIds.get(k) ?? firstSpelling.get(k) ?? e.employeeIdNo.trim();
      if (!firstSpelling.has(k)) firstSpelling.set(k, e.employeeIdNo);
    }
  }
  const uploadedIds = [...new Set(months.flatMap((m) => m.entries.map((e) => e.employeeIdNo)))];
  const foreignIds = new Set(uploadedIds.filter((id) => foreignKeys.has(idKey(id))));
  // Trades likewise: "STEEL FIXER" is the trade already on file as "Steel Fixer".
  const canonTrade = await loadTradeCanon(db, branchId);
  for (const m of months) for (const e of m.entries) e.trade = canonTrade(e.trade);

  // Projects the sheet may name, by code or name, within this branch.
  const branchProjects = (await db.project.findMany({ where: { branchId }, select: { id: true, code: true, name: true } }));
  const projectByKey = new Map<string, string>();
  for (const p of branchProjects) { projectByKey.set(p.name.trim().toLowerCase(), p.id); projectByKey.set(p.code.trim().toLowerCase(), p.id); }
  const projectsNotFound = new Set<string>();
  let payRatesSet = 0;
  const payRateGiven = new Set<string>();
  let linkedToProject = 0;

  const supplierByKey = new Map(
    existingSuppliers.map((s) => [normalizeKey(s.name), s])
  );
  // Suppliers that already have subsidiaries, and the employees this branch
  // already holds — a re-upload must not overwrite what people set by hand.
  const hasSubsidiaries = new Set(existingSuppliers.map((s) => s.parentSupplierId).filter(Boolean) as string[]);
  const knownEmployees = new Map(
    (
      await db.employee.findMany({
        where: { branchId, employeeIdNo: { in: uploadedIds } },
        select: { employeeIdNo: true, sponsorSupplierId: true, nationality: true, projectId: true, hourlyRate: true },
      })
    ).map((e) => [e.employeeIdNo, e])
  );
  // sponsor -> main supplier -> rows ("" = the sponsor is its own main supplier),
  // and the companies that other sponsors are listed under, to place sponsors
  // under their main supplier once the whole file has been read.
  const sponsorVotes = new Map<string, Map<string, number>>();
  const parentsOfOthers = new Set<string>();
  const findOrCreateSupplier = async (name: string) => {
    const key = normalizeKey(name);
    let s = supplierByKey.get(key);
    if (!s) {
      s = await db.supplier.create({
        data: { name: name.trim(), code: await uniqueSupplierCode(name.trim(), branchId, undefined, db), branchId },
      });
      supplierByKey.set(key, s);
      stats.suppliersCreated++;
    }
    return s;
  };
  const clientByKey = new Map(
    existingClients.map((c) => [normalizeKey(c.name), c])
  );

  const stats: ImportStats = {
    monthsProcessed: [],
    suppliersCreated: 0,
    clientsCreated: 0,
    entriesCreated: 0,
    entriesUpdated: 0,
    rowsSkipped: 0,
    skippedRowDetails: [],
    unrecognizedSheets: [],
  };

  for (const month of months) {
    stats.rowsSkipped += month.skippedRows;
    stats.skippedRowDetails.push(...month.skippedRowDetails);

    for (const [entryIndex, entry] of month.entries.entries()) {
      if (foreignIds.has(entry.employeeIdNo)) {
        stats.rowsSkipped++;
        stats.skippedRowDetails.push({
          sheetName: month.sheetName,
          row: entryIndex + 1,
          name: entry.employeeName,
          idNo: entry.employeeIdNo,
          reason: "This employee ID is already in use by another company. Use a different ID.",
        });
        continue;
      }
      const supplierKey = normalizeKey(entry.supplierName);
      const supplier = await findOrCreateSupplier(entry.supplierName);

      // The sponsor (visa-holding company) is a supplier record too.
      let sponsorId: string | null = null;
      if (entry.sponsorName) {
        const sponsorKey = normalizeKey(entry.sponsorName);
        sponsorId = (await findOrCreateSupplier(entry.sponsorName)).id;
        const vote = sponsorKey === supplierKey ? "" : supplierKey;
        if (vote) parentsOfOthers.add(supplierKey);
        const votes = sponsorVotes.get(sponsorKey) ?? new Map<string, number>();
        votes.set(vote, (votes.get(vote) ?? 0) + 1);
        sponsorVotes.set(sponsorKey, votes);
      }

      let clientId: string | null = null;
      if (entry.clientName) {
        const clientKey = normalizeKey(entry.clientName);
        let client = clientByKey.get(clientKey);
        if (!client) {
          client = await db.client.create({
            data: { name: entry.clientName.trim(), code: await uniqueClientCode(entry.clientName.trim(), branchId, undefined, db), branchId },
          });
          clientByKey.set(clientKey, client);
          stats.clientsCreated++;
        }
        clientId = client.id;
      }

      let sheetProjectId: string | null = null;
      if (entry.projectName) {
        sheetProjectId = projectByKey.get(entry.projectName.trim().toLowerCase()) ?? null;
        if (!sheetProjectId && projectsNotFound.size < 10) projectsNotFound.add(entry.projectName.trim());
      }
      const entryProjectId = projectId ?? sheetProjectId;

      const existing = await db.timesheetEntry.findUnique({
        where: {
          month_supplierId_employeeIdNo_trade: {
            month: month.month,
            supplierId: supplier.id,
            employeeIdNo: entry.employeeIdNo,
            trade: entry.trade,
          },
        },
      });

      // A re-upload must never silently overwrite hours on an entry that's
      // already locked (invoiced) — skip it entirely and count it as
      // unchanged rather than clobbering billed data.
      if (existing?.status === "LOCKED") {
        stats.rowsSkipped++;
        continue;
      }

      await db.timesheetEntry.upsert({
        where: {
          month_supplierId_employeeIdNo_trade: {
            month: month.month,
            supplierId: supplier.id,
            employeeIdNo: entry.employeeIdNo,
            trade: entry.trade,
          },
        },
        create: {
          month: month.month,
          monthLabel: month.monthLabel,
          employeeIdNo: entry.employeeIdNo,
          employeeName: entry.employeeName,
          trade: entry.trade,
          rate: entry.rate,
          site: entry.site,
          siteId: entry.siteId ?? null,
          dailyHours: JSON.stringify(entry.dailyHours),
          totalHours: entry.totalHours,
          absentCount: entry.absentCount,
          absentDeduction: calculateAbsentDeduction(entry.absentCount),
          invoiceValue: entry.invoiceValue,
          branchId,
          supplierId: supplier.id,
          clientId,
          projectId: entryProjectId,
        },
        update: {
          employeeName: entry.employeeName,
          rate: entry.rate,
          site: entry.site,
          monthLabel: month.monthLabel,
          dailyHours: JSON.stringify(entry.dailyHours),
          totalHours: entry.totalHours,
          absentCount: entry.absentCount,
          invoiceValue: entry.invoiceValue,
          clientId,
          // Only touch projectId/siteId when this import explicitly carries
          // one (manual entry) — a plain Excel re-upload must not clobber a
          // project/site tag set on a prior pass for the same row.
          ...(entryProjectId ? { projectId: entryProjectId } : {}),
          ...(entry.siteId ? { siteId: entry.siteId } : {}),
          // Preserve any manually-entered absent deduction from a prior
          // review unless the recomputed absent count changed.
        },
      });

      if (existing) stats.entriesUpdated++;
      else stats.entriesCreated++;

      // Auto-create/refresh the Employee master record. Only the
      // upload-sourced fields (name, trade, supplier) are touched here —
      // compliance dates, photo, nationality, etc. are manually owned and
      // must never be overwritten by a re-upload.
      const known = knownEmployees.get(entry.employeeIdNo);
      const nat = normalizeNationality(entry.nationality);
      const nationality = nat.value;
      if (entry.nationality && !nationality && nat.status !== "empty") {
        skippedNationality++;
        if (skippedNationalityValues.size < 5) skippedNationalityValues.add(entry.nationality.trim());
      }
      // Sponsor and nationality only fill an empty field: they are the kind of
      // detail people correct by hand, and a re-upload must not undo that.
      const fillSponsor = sponsorId && !known?.sponsorSupplierId ? { sponsorSupplierId: sponsorId } : {};
      const fillNationality = nationality && !known?.nationality ? { nationality } : {};
      // Linked to a project means deployed, so a worker the sheet puts on a
      // project is linked to it — but only when they aren't on one already.
      const fillProject = sheetProjectId && !known?.projectId ? { projectId: sheetProjectId } : {};
      const needsPay = !!entry.payRate && !Number(known?.hourlyRate ?? 0) && !payRateGiven.has(entry.employeeIdNo);
      const fillPay = needsPay ? { hourlyRate: entry.payRate } : {};
      if (sheetProjectId && !known?.projectId) linkedToProject++;
      if (needsPay) { payRatesSet++; payRateGiven.add(entry.employeeIdNo); }
      const employeeRecord = await db.employee.upsert({
        where: { employeeIdNo: entry.employeeIdNo },
        create: {
          employeeIdNo: entry.employeeIdNo,
          name: entry.employeeName,
          trade: entry.trade,
          supplierId: supplier.id,
          branchId,
          status: "IDLE", // on the books; mobilising them is a separate step
          ...fillSponsor,
          ...fillNationality,
          ...fillProject,
          ...fillPay,
        },
        update: {
          name: entry.employeeName,
          trade: entry.trade,
          supplierId: supplier.id,
          ...fillSponsor,
          ...fillNationality,
          ...fillProject,
          ...fillPay,
        },
      });
      if (opts.userId) {
        await writeAttendanceFromEntry(
          db,
          { employeeId: employeeRecord.id, supplierId: supplier.id, branchId, markedById: opts.userId, projectId: entryProjectId ?? known?.projectId ?? employeeRecord.projectId ?? null, worker: { siteArrivalDate: employeeRecord.siteArrivalDate, status: employeeRecord.status }, days: entry.dailyHours },
          attendance,
        );
      }
      await opts.progress?.(++processed, totalEntries);
      knownEmployees.set(entry.employeeIdNo, {
        employeeIdNo: entry.employeeIdNo,
        sponsorSupplierId: known?.sponsorSupplierId ?? sponsorId,
        nationality: known?.nationality ?? nationality ?? null,
        projectId: known?.projectId ?? sheetProjectId,
        hourlyRate: known?.hourlyRate ?? null,
      });
    }

    await db.uploadMonth.create({
      data: {
        month: month.month,
        monthLabel: month.monthLabel,
        sheetName: month.sheetName,
        rowCount: month.entries.length,
        uploadId,
      },
    });

    stats.monthsProcessed.push({
      month: month.month,
      monthLabel: month.monthLabel,
      entries: month.entries.length,
    });
  }

  // Place each sponsor under the main supplier it works for most, when that is
  // safe: nobody is listed under it, it has no subsidiaries or parent yet, and
  // the main supplier is a primary one.
  let linked = 0;
  for (const [sponsorKey, votes] of sponsorVotes) {
    // A company that other sponsors are listed under is a real parent itself.
    if (parentsOfOthers.has(sponsorKey)) continue;
    // Most rows win; a tie stays primary.
    const mainKey = [...votes.entries()].sort((a, b) => b[1] - a[1] || (a[0] === "" ? -1 : 1))[0]?.[0];
    if (!mainKey) continue;
    const sponsor = supplierByKey.get(sponsorKey);
    const main = supplierByKey.get(mainKey);
    if (!sponsor || !main || sponsor.id === main.id) continue;
    if (sponsor.parentSupplierId || hasSubsidiaries.has(sponsor.id) || main.parentSupplierId) continue;
    await db.supplier.update({ where: { id: sponsor.id }, data: { parentSupplierId: main.id } });
    sponsor.parentSupplierId = main.id;
    linked++;
  }
  stats.subsidiariesLinked = linked;
  if (skippedNationality > 0) {
    stats.nationalityNotSaved = skippedNationality;
    stats.nationalityNotSavedValues = [...skippedNationalityValues];
  }
  if (projectsNotFound.size > 0) stats.projectsNotFound = [...projectsNotFound];
  if (payRatesSet > 0) stats.payRatesSet = payRatesSet;
  if (linkedToProject > 0) stats.workersLinkedToProject = linkedToProject;
  if (opts.userId) {
    stats.attendanceCreated = attendance.attendanceCreated;
    stats.attendanceConflicts = attendance.attendanceConflicts;
    stats.attendanceLocked = attendance.attendanceLocked;
    stats.attendanceUnrecognised = attendance.attendanceUnrecognised;
    stats.unrecognisedValues = [...attendance.unrecognisedValues];
  }

  return stats;
}
