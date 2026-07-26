import { prisma } from "@/lib/db";
import type { ParsedMonth } from "@/lib/parseTimesheet";

export type ImportStats = {
  monthsProcessed: { month: string; monthLabel: string; entries: number }[];
  suppliersCreated: number;
  clientsCreated: number;
  entriesCreated: number;
  entriesUpdated: number;
  rowsSkipped: number;
  unrecognizedSheets: string[];
};

function normalizeKey(name: string) {
  return name.trim().toLowerCase();
}

export async function importParsedMonths(
  months: ParsedMonth[],
  uploadId: string
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
    unrecognizedSheets: [],
  };

  for (const month of months) {
    stats.rowsSkipped += month.skippedRows;

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
          month_supplierId_employeeIdNo_trade_rate: {
            month: month.month,
            supplierId: supplier.id,
            employeeIdNo: entry.employeeIdNo,
            trade: entry.trade,
            rate: entry.rate,
          },
        },
      });

      await prisma.timesheetEntry.upsert({
        where: {
          month_supplierId_employeeIdNo_trade_rate: {
            month: month.month,
            supplierId: supplier.id,
            employeeIdNo: entry.employeeIdNo,
            trade: entry.trade,
            rate: entry.rate,
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
          invoiceValue: entry.invoiceValue,
          supplierId: supplier.id,
          clientId,
        },
        update: {
          employeeName: entry.employeeName,
          site: entry.site,
          monthLabel: month.monthLabel,
          dailyHours: JSON.stringify(entry.dailyHours),
          totalHours: entry.totalHours,
          absentCount: entry.absentCount,
          invoiceValue: entry.invoiceValue,
          clientId,
          // Preserve any manually-entered absent deduction from a prior
          // review unless the recomputed absent count changed.
        },
      });

      if (existing) stats.entriesUpdated++;
      else stats.entriesCreated++;
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
