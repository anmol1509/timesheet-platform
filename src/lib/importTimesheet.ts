import { prisma } from "@/lib/db";
import type { ParsedMonth, SkippedRow } from "@/lib/parseTimesheet";
import { calculateAbsentDeduction } from "@/lib/deductions";

export type ImportStats = {
  monthsProcessed: { month: string; monthLabel: string; entries: number }[];
  suppliersCreated: number;
  clientsCreated: number;
  entriesCreated: number;
  entriesUpdated: number;
  rowsSkipped: number;
  skippedRowDetails: SkippedRow[];
  unrecognizedSheets: string[];
};

function normalizeKey(name: string) {
  return name.trim().toLowerCase();
}

export async function importParsedMonths(
  months: ParsedMonth[],
  uploadId: string,
  projectId: string | null = null
): Promise<ImportStats> {
  const [existingSuppliers, existingClients] = await Promise.all([
    prisma.supplier.findMany(),
    prisma.client.findMany(),
  ]);

  const supplierByKey = new Map(
    existingSuppliers.map((s) => [normalizeKey(s.name), s])
  );
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

    for (const entry of month.entries) {
      const supplierKey = normalizeKey(entry.supplierName);
      let supplier = supplierByKey.get(supplierKey);
      if (!supplier) {
        supplier = await prisma.supplier.create({
          data: { name: entry.supplierName.trim() },
        });
        supplierByKey.set(supplierKey, supplier);
        stats.suppliersCreated++;
      }

      let clientId: string | null = null;
      if (entry.clientName) {
        const clientKey = normalizeKey(entry.clientName);
        let client = clientByKey.get(clientKey);
        if (!client) {
          client = await prisma.client.create({
            data: { name: entry.clientName.trim() },
          });
          clientByKey.set(clientKey, client);
          stats.clientsCreated++;
        }
        clientId = client.id;
      }

      const existing = await prisma.timesheetEntry.findUnique({
        where: {
          month_supplierId_employeeIdNo_trade: {
            month: month.month,
            supplierId: supplier.id,
            employeeIdNo: entry.employeeIdNo,
            trade: entry.trade,
          },
        },
      });

      await prisma.timesheetEntry.upsert({
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
          dailyHours: JSON.stringify(entry.dailyHours),
          totalHours: entry.totalHours,
          absentCount: entry.absentCount,
          absentDeduction: calculateAbsentDeduction(entry.absentCount),
          invoiceValue: entry.invoiceValue,
          supplierId: supplier.id,
          clientId,
          projectId,
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
          // Only touch projectId when this import explicitly carries one
          // (manual entry) — a plain Excel re-upload must not clobber a
          // project tag set on a prior pass for the same row.
          ...(projectId ? { projectId } : {}),
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
      await prisma.employee.upsert({
        where: { employeeIdNo: entry.employeeIdNo },
        create: {
          employeeIdNo: entry.employeeIdNo,
          name: entry.employeeName,
          trade: entry.trade,
          supplierId: supplier.id,
        },
        update: {
          name: entry.employeeName,
          trade: entry.trade,
          supplierId: supplier.id,
        },
      });
    }

    await prisma.uploadMonth.create({
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

  return stats;
}
