import { prisma } from "@/lib/db";
import { daysUntil, COMPLIANCE_FIELDS } from "@/lib/compliance";
import { branchWhere } from "@/lib/branch";

export type RunwayBucketKey = "expired" | "d30" | "d60" | "d90";

export type RunwayBucket = {
  key: RunwayBucketKey;
  label: string;
  count: number;
};

export type RunwayDocumentRow = {
  label: string;
  expired: number;
  d30: number;
  d60: number;
  d90: number;
  total: number;
};

export type ComplianceRunway = {
  buckets: RunwayBucket[];
  documents: RunwayDocumentRow[];
  /** Documents falling due inside the 90-day horizon, expired ones included. */
  total: number;
};

const BUCKET_LABELS: Record<RunwayBucketKey, string> = {
  expired: "Expired",
  d30: "Next 30 days",
  d60: "31–60 days",
  d90: "61–90 days",
};

function bucketFor(days: number): RunwayBucketKey | null {
  if (days < 0) return "expired";
  if (days <= 30) return "d30";
  if (days <= 60) return "d60";
  if (days <= 90) return "d90";
  return null;
}

/**
 * Document expiries across the next 90 days, bucketed by how much runway is
 * left and split by document type.
 *
 * Covers all of COMPLIANCE_FIELDS — wider than getComplianceAlerts, which
 * reads only the five headline documents and caps at 30 days. The two are
 * meant to answer different questions: that one is "what is on fire today",
 * this one is "what is coming".
 */
export async function getComplianceRunway(
  branchId: string | null = null
): Promise<ComplianceRunway> {
  const employees = await prisma.employee.findMany({
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
  });

  const rows = new Map<string, RunwayDocumentRow>(
    COMPLIANCE_FIELDS.map((f) => [
      f.label,
      { label: f.label, expired: 0, d30: 0, d60: 0, d90: 0, total: 0 },
    ])
  );
  const totals: Record<RunwayBucketKey, number> = { expired: 0, d30: 0, d60: 0, d90: 0 };

  for (const employee of employees) {
    for (const field of COMPLIANCE_FIELDS) {
      const date = employee[field.key as keyof typeof employee] as Date | null;
      if (!date) continue;
      const bucket = bucketFor(daysUntil(date));
      if (!bucket) continue;
      const row = rows.get(field.label)!;
      row[bucket] += 1;
      row.total += 1;
      totals[bucket] += 1;
    }
  }

  const buckets = (Object.keys(BUCKET_LABELS) as RunwayBucketKey[]).map((key) => ({
    key,
    label: BUCKET_LABELS[key],
    count: totals[key],
  }));

  return {
    buckets,
    // Document types nothing is due for would render as empty rows, so they
    // are dropped rather than padding the chart with zeros.
    documents: [...rows.values()].filter((r) => r.total > 0).sort((a, b) => b.total - a.total),
    total: buckets.reduce((sum, b) => sum + b.count, 0),
  };
}
