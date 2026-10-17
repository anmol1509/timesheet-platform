import { prisma } from "@/lib/db";

export type SalesActivityKind = "NOTE" | "CALL" | "SENT" | "REVISION" | "STATUS" | "CREATED" | "FOLLOWUP" | "LOST";

/** Adds a line to the activity trail of a quotation or enquiry. */
export async function logSalesActivity(p: {
  quotationId?: string;
  enquiryId?: string;
  kind: SalesActivityKind;
  body: string;
  user: { id: string; name: string };
  branchId: string | null;
}) {
  await prisma.salesActivity.create({
    data: {
      quotationId: p.quotationId ?? null,
      enquiryId: p.enquiryId ?? null,
      kind: p.kind,
      body: p.body.slice(0, 2000),
      userId: p.user.id,
      userName: p.user.name,
      branchId: p.branchId,
    },
  });
}
