"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

function dateOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(s) : null;
}

async function assertQuotationInBranch(id: string, branchId: string | null, isSuperAdmin: boolean) {
  const quotation = await prisma.quotation.findUnique({ where: { id }, select: { branchId: true } });
  return !!quotation && !isOutsideBranch(quotation.branchId, branchId, isSuperAdmin);
}

async function nextQuotationNumber() {
  const count = await prisma.quotation.count();
  return `QTN-${String(count + 1).padStart(6, "0")}`;
}

type LineInput = {
  trade: string;
  quantity: number;
  rate: number;
  otRate: number | null;
  nationality: string | null;
  workingHours: string | null;
};

export async function createQuotationAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const enquiryId = stringOrNull(formData.get("enquiryId"));
  if (!clientId || !branchId) return;

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { branchId: true } });
  if (!client || isOutsideBranch(client.branchId, branchId, isSuperAdmin)) return;

  if (enquiryId) {
    const enquiry = await prisma.enquiry.findUnique({ where: { id: enquiryId }, select: { branchId: true } });
    if (!enquiry || isOutsideBranch(enquiry.branchId, branchId, isSuperAdmin)) return;
  }

  let lines: LineInput[];
  try {
    lines = JSON.parse(String(formData.get("linesJson") || "[]"));
  } catch {
    lines = [];
  }
  lines = lines.filter((l) => l.trade && l.quantity > 0 && l.rate >= 0);
  if (lines.length === 0) return;

  const quotationNumber = await nextQuotationNumber();
  const created = await prisma.quotation.create({
    data: {
      quotationNumber,
      clientId,
      enquiryId,
      branchId,
      createdById: user.id,
      validUntil: dateOrNull(formData.get("validUntil")),
      terms: stringOrNull(formData.get("terms")),
      accommodationResponsibility: stringOrNull(formData.get("accommodationResponsibility")),
      transportationResponsibility: stringOrNull(formData.get("transportationResponsibility")),
      ppeResponsibility: stringOrNull(formData.get("ppeResponsibility")),
      lines: { create: lines },
    },
  });

  if (enquiryId) {
    await prisma.enquiry.update({ where: { id: enquiryId }, data: { status: "Quoted" } });
  }

  await logAudit({
    entityType: "QUOTATION",
    entityId: created.id,
    action: "CREATE",
    after: { quotationNumber, clientId, enquiryId, lines },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/sales/quotations");
  redirect(`/sales/quotations/${created.id}`);
}

// Legal forward transitions for the quotation status, same plain-string +
// inline-check convention used by Timesheet (Phase B). "CONVERTED" is set
// only by convertQuotationToProjectAction below, not through this action.
const QUOTATION_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT"],
  SENT: ["NEGOTIATION", "APPROVED", "REJECTED"],
  NEGOTIATION: ["APPROVED", "REJECTED"],
  APPROVED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
  CONVERTED: [],
};

export async function updateQuotationStatusAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("quotationId") || "");
  const toStatus = String(formData.get("status") || "");
  if (!id || !toStatus) return;
  if (!(await assertQuotationInBranch(id, branchId, isSuperAdmin))) return;

  const before = await prisma.quotation.findUnique({ where: { id } });
  if (!before || !QUOTATION_TRANSITIONS[before.status]?.includes(toStatus)) return;

  await prisma.quotation.update({ where: { id }, data: { status: toStatus } });

  await logAudit({
    entityType: "QUOTATION",
    entityId: id,
    action: "UPDATE",
    before: { status: before.status },
    after: { status: toStatus },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/sales/quotations/${id}`);
  revalidatePath("/sales/quotations");
}

export async function updateQuotationDetailsAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("quotationId") || "");
  if (!id) return;
  if (!(await assertQuotationInBranch(id, branchId, isSuperAdmin))) return;

  const before = await prisma.quotation.findUnique({ where: { id } });
  if (!before || before.status !== "DRAFT") return; // only editable while DRAFT

  const data = {
    validUntil: dateOrNull(formData.get("validUntil")),
    terms: stringOrNull(formData.get("terms")),
    accommodationResponsibility: stringOrNull(formData.get("accommodationResponsibility")),
    transportationResponsibility: stringOrNull(formData.get("transportationResponsibility")),
    ppeResponsibility: stringOrNull(formData.get("ppeResponsibility")),
  };

  await prisma.quotation.update({ where: { id }, data });

  await logAudit({
    entityType: "QUOTATION",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/sales/quotations/${id}`);
}

// Converts an ACCEPTED quotation into a real Project (minimal-fields shape,
// mirroring createProjectAction), then marks the quotation CONVERTED.
// Creating an Lpo per line is optional — checked explicitly on the form,
// since not every accepted quotation arrives with firm LPO terms yet.
export async function convertQuotationToProjectAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("quotationId") || "");
  const createLpos = formData.get("createLpos") === "on";
  if (!id || !branchId) return;
  if (!(await assertQuotationInBranch(id, branchId, isSuperAdmin))) return;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { lines: true, client: true },
  });
  if (!quotation || quotation.status !== "ACCEPTED") return;

  const projectCount = await prisma.project.count();
  const projectCode = `PRJ${String(projectCount + 1).padStart(3, "0")}`;

  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        code: projectCode,
        name: `${quotation.client.name} — ${quotation.quotationNumber}`,
        clientId: quotation.clientId,
        branchId: branchId!,
        status: "PLANNING",
      },
    });

    if (createLpos) {
      for (const line of quotation.lines) {
        const lpoCount = await tx.lpo.count();
        await tx.lpo.create({
          data: {
            lpoNumber: `LPO-${String(lpoCount + 1).padStart(6, "0")}`,
            projectId: project.id,
            clientId: quotation.clientId,
            branchId: branchId!,
            trade: line.trade,
            quantity: line.quantity,
            rate: line.rate,
            validFrom: new Date(),
            validTo: quotation.validUntil,
          },
        });
      }
    }

    await tx.quotation.update({
      where: { id },
      data: { status: "CONVERTED", projectId: project.id },
    });

    return project;
  });

  await logAudit({
    entityType: "QUOTATION",
    entityId: id,
    action: "UPDATE",
    before: { status: "ACCEPTED" },
    after: { status: "CONVERTED", projectId: result.id },
    userId: user.id,
    userName: user.name,
    branchId,
  });
  await logAudit({
    entityType: "PROJECT",
    entityId: result.id,
    action: "CREATE",
    after: { code: projectCode, clientId: quotation.clientId, fromQuotation: quotation.quotationNumber },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/sales/quotations/${id}`);
  revalidatePath("/projects");
  redirect(`/projects/${result.id}`);
}
