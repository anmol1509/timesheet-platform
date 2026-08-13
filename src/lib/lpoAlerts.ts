import { prisma } from "@/lib/db";
import { daysUntil } from "@/lib/compliance";
import { branchWhere } from "@/lib/branch";

const ALERT_THRESHOLD_DAYS = 30;
const LOW_BALANCE_RATIO = 0.1;

export type LpoAlert = {
  lpoId: string;
  lpoNumber: string;
  projectId: string;
  projectName: string;
  kind: "EXPIRING" | "LOW_BALANCE";
  days: number | null; // days to expiry, for EXPIRING alerts
  remaining: number | null; // remaining balance, for LOW_BALANCE alerts
};

export async function getLpoAlerts(branchId: string | null = null): Promise<LpoAlert[]> {
  const lpos = await prisma.lpo.findMany({
    where: { ...branchWhere(branchId), status: "ACTIVE" },
    select: {
      id: true,
      lpoNumber: true,
      value: true,
      billedAmount: true,
      validTo: true,
      project: { select: { id: true, name: true } },
    },
  });

  const alerts: LpoAlert[] = [];
  for (const lpo of lpos) {
    if (lpo.validTo) {
      const days = daysUntil(lpo.validTo);
      if (days <= ALERT_THRESHOLD_DAYS) {
        alerts.push({
          lpoId: lpo.id,
          lpoNumber: lpo.lpoNumber,
          projectId: lpo.project.id,
          projectName: lpo.project.name,
          kind: "EXPIRING",
          days,
          remaining: null,
        });
      }
    }
    if (lpo.value != null && lpo.value > 0) {
      const remaining = lpo.value - lpo.billedAmount;
      if (remaining / lpo.value < LOW_BALANCE_RATIO) {
        alerts.push({
          lpoId: lpo.id,
          lpoNumber: lpo.lpoNumber,
          projectId: lpo.project.id,
          projectName: lpo.project.name,
          kind: "LOW_BALANCE",
          days: null,
          remaining,
        });
      }
    }
  }
  alerts.sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  return alerts;
}
