export type ComplianceStatus = "expired" | "expiring" | "valid" | "not_set";

const EXPIRING_THRESHOLD_DAYS = 30;

export function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export function complianceStatus(date: Date | null): ComplianceStatus {
  if (!date) return "not_set";
  const days = daysUntil(date);
  if (days < 0) return "expired";
  if (days <= EXPIRING_THRESHOLD_DAYS) return "expiring";
  return "valid";
}

export const COMPLIANCE_FIELDS = [
  { key: "visaExpiry", label: "Visa" },
  { key: "laborCardExpiry", label: "Labor Card" },
  { key: "medicalExpiry", label: "Medical Certificate" },
  { key: "passportExpiry", label: "Passport" },
] as const;
