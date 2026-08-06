// One-off backfill: seeds LookupValue from every distinct value already
// sitting in production Employee rows for the 15 fields being switched from
// free text to a Select, so nothing already typed in becomes an invisible
// value once the UI stops accepting arbitrary text. Safe to re-run —
// createMany uses skipDuplicates.
import "dotenv/config";
import { PrismaClient, Prisma } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const FIELD_TO_CATEGORY: Record<string, string> = {
  position: "POSITION",
  bloodGroup: "BLOOD_GROUP",
  religion: "RELIGION",
  state: "STATE",
  accommodationType: "ACCOMMODATION_TYPE",
  visaType: "VISA_TYPE",
  visaStatus: "VISA_STATUS",
  passportStatus: "PASSPORT_STATUS",
  laborCardStatus: "LABOR_CARD_STATUS",
  cicpaStatus: "CICPA_STATUS",
  insuranceCardType: "INSURANCE_CARD_TYPE",
  insuranceStatus: "INSURANCE_STATUS",
  drivingLicenceType: "DRIVING_LICENCE_TYPE",
  drivingLicenceStatus: "DRIVING_LICENCE_STATUS",
  medicalStatus: "MEDICAL_STATUS",
  eidStatus: "EID_STATUS",
};

async function main() {
  let totalInserted = 0;

  for (const [field, category] of Object.entries(FIELD_TO_CATEGORY)) {
    const rows: Record<string, unknown>[] = await prisma.employee.findMany({
      where: { [field]: { not: null } },
      select: { branchId: true, [field]: true },
      distinct: ["branchId", field] as Prisma.EmployeeScalarFieldEnum[],
    });

    const data = rows
      .map((r) => ({ branchId: r.branchId as string, category, value: String(r[field] ?? "").trim() }))
      .filter((r: { value: string }) => r.value.length > 0);

    if (data.length === 0) continue;

    const result = await prisma.lookupValue.createMany({ data, skipDuplicates: true });
    totalInserted += result.count;
    console.log(`${category}: inserted ${result.count} of ${data.length} distinct values`);
  }

  console.log(`Done. ${totalInserted} lookup values inserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
