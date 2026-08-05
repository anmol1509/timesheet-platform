import { prisma } from "@/lib/db";
import { daysUntil } from "@/lib/compliance";
import { branchWhere } from "@/lib/branch";

export type DocumentExpiryCategory = {
  category: string;
  total: number;
  expiringSoon: number;
  expired: number;
};

const EXPIRY_THRESHOLD_DAYS = 30;

function bucket(dates: (Date | null)[]) {
  let total = 0;
  let expiringSoon = 0;
  let expired = 0;
  for (const date of dates) {
    if (!date) continue;
    total++;
    const days = daysUntil(date);
    if (days < 0) expired++;
    else if (days <= EXPIRY_THRESHOLD_DAYS) expiringSoon++;
  }
  return { total, expiringSoon, expired };
}

// Mirrors the competitor dashboard's "Notification for Expiry" widget: a
// per-category breakdown, not just the employee-only alerts already shown
// by getComplianceAlerts().
export async function getDocumentExpiryCounts(
  branchId: string | null
): Promise<DocumentExpiryCategory[]> {
  const [employees, clientDocs, projectDocs, supplierAttachments] = await Promise.all([
    prisma.employee.findMany({
      where: branchWhere(branchId),
      select: {
        visaExpiry: true,
        laborCardExpiry: true,
        medicalExpiry: true,
        passportExpiry: true,
        emiratesIdExpiry: true,
        cicpaExpiry: true,
        insuranceExpiry: true,
        drivingLicenceExpiry: true,
      },
    }),
    prisma.clientDocument.findMany({
      where: { client: branchWhere(branchId) },
      select: { expiryDate: true },
    }),
    prisma.projectDocument.findMany({
      where: { project: branchWhere(branchId) },
      select: { expiryDate: true },
    }),
    prisma.attachment.findMany({
      where: { entityType: "SUPPLIER", ...branchWhere(branchId) },
      select: { expiryDate: true },
    }),
  ]);

  const employeeDates = employees.flatMap((e) => [
    e.visaExpiry,
    e.laborCardExpiry,
    e.medicalExpiry,
    e.passportExpiry,
    e.emiratesIdExpiry,
    e.cicpaExpiry,
    e.insuranceExpiry,
    e.drivingLicenceExpiry,
  ]);

  return [
    { category: "Employee Documents", ...bucket(employeeDates) },
    { category: "Client Documents", ...bucket(clientDocs.map((d) => d.expiryDate)) },
    { category: "Project Documents", ...bucket(projectDocs.map((d) => d.expiryDate)) },
    { category: "Supplier Documents", ...bucket(supplierAttachments.map((d) => d.expiryDate)) },
  ];
}
