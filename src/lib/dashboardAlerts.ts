import { prisma } from "@/lib/db";
import { daysUntil, COMPLIANCE_FIELDS } from "@/lib/compliance";

const ALERT_THRESHOLD_DAYS = 30;

export type ComplianceAlert = {
  employeeId: string;
  name: string;
  field: string;
  days: number;
};

export async function getComplianceAlerts(): Promise<ComplianceAlert[]> {
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      name: true,
      visaExpiry: true,
      laborCardExpiry: true,
      medicalExpiry: true,
      passportExpiry: true,
      emiratesIdExpiry: true,
    },
  });

  const alerts: ComplianceAlert[] = [];
  for (const e of employees) {
    for (const f of COMPLIANCE_FIELDS) {
      const date = e[f.key as keyof typeof e] as Date | null;
      if (!date) continue;
      const days = daysUntil(date);
      if (days <= ALERT_THRESHOLD_DAYS) {
        alerts.push({ employeeId: e.id, name: e.name, field: f.label, days });
      }
    }
  }
  alerts.sort((a, b) => a.days - b.days);
  return alerts;
}
