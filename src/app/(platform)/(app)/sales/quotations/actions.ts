"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { nextCode } from "@/lib/nextCode";
import { requireUserWithBranch, requirePermission, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { QUOTATION_TRANSITIONS } from "@/lib/salesPipeline";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";
import { clearDraft } from "@/lib/drafts";
import { getOrCreateSkill } from "@/lib/skillScope";
import { parseAdjustments } from "@/lib/quotationMath";
import { logSalesActivity } from "@/lib/salesActivity";

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
  return nextCode("QTN-", 6, (await prisma.quotation.findMany({ where: { quotationNumber: { startsWith: "QTN-" } }, select: { quotationNumber: true } })).map((q) => q.quotationNumber));
}

type LineInput = {
  trade: string;
  quantity: number;
  rate: number;
  otRate: number | null;
  nationality: string | null;
  workingHours: string | null;
  unit: string;
  unitLabel: string | null;
  unitsPerMonth: number;
  durationMonths: number | null;
  hoursPerDay: number | null;
  costPerMonth: number | null;
  costBreakdown: { label: string; amount: number }[] | null;
};

const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Reads the lines the form sent, keeping only whole, sensible ones. */
function parseLines(raw: FormDataEntryValue | null): LineInput[] {
  let rows: Record<string, unknown>[];
  try {
    rows = JSON.parse(String(raw || "[]"));
  } catch {
    rows = [];
  }
  if (!Array.isArray(rows)) return [];
  const out: LineInput[] = [];
  for (const r of rows) {
    const trade = typeof r.trade === "string" ? r.trade.trim() : "";
    const quantity = finite(r.quantity);
    const rate = finite(r.rate);
    if (!trade || quantity == null || quantity <= 0 || rate == null || rate < 0) continue;
    const unit = r.unit === "DAY" || r.unit === "HOUR" || r.unit === "CUSTOM" ? r.unit : "MONTH";
    const perMonth = unit === "CUSTOM" ? finite(r.unitsPerMonth) : 1;
    if (unit === "CUSTOM" && (perMonth == null || perMonth <= 0)) continue;
    const breakdown = Array.isArray(r.costBreakdown)
      ? (r.costBreakdown as Record<string, unknown>[])
          .filter((p) => p && typeof p.label === "string" && finite(p.amount) != null)
          .map((p) => ({ label: String(p.label), amount: p.amount as number }))
      : null;
    out.push({
      trade,
      quantity,
      rate,
      otRate: finite(r.otRate),
      nationality: typeof r.nationality === "string" && r.nationality.trim() ? r.nationality.trim() : null,
      workingHours: typeof r.workingHours === "string" && r.workingHours.trim() ? r.workingHours.trim() : null,
      unit,
      unitLabel: unit === "CUSTOM" && typeof r.unitLabel === "string" && r.unitLabel.trim() ? r.unitLabel.trim() : null,
      unitsPerMonth: perMonth ?? 1,
      durationMonths: finite(r.durationMonths),
      hoursPerDay: finite(r.hoursPerDay),
      costPerMonth: finite(r.costPerMonth),
      costBreakdown: breakdown && breakdown.length > 0 ? breakdown : null,
    });
  }
  return out;
}

/** The fields shared by create and revise, read from the form. */
function readHeader(formData: FormData) {
  return {
    validUntil: dateOrNull(formData.get("validUntil")),
    terms: stringOrNull(formData.get("terms")),
    coverIntro: stringOrNull(formData.get("coverIntro")),
    coverClosing: stringOrNull(formData.get("coverClosing")),
    accommodationResponsibility: stringOrNull(formData.get("accommodationResponsibility")),
    transportationResponsibility: stringOrNull(formData.get("transportationResponsibility")),
    ppeResponsibility: stringOrNull(formData.get("ppeResponsibility")),
    contactId: stringOrNull(formData.get("contactId")),
    currency: stringOrNull(formData.get("currency")) || "AED",
    showCost: formData.get("showCost") === "on",
    nextFollowUpAt: dateOrNull(formData.get("nextFollowUpAt")),
  };
}

function readAdjustments(raw: FormDataEntryValue | null) {
  try {
    return parseAdjustments(JSON.parse(String(raw || "[]")));
  } catch {
    return [];
  }
}

/** A contact must belong to the quotation's client. */
async function contactOk(contactId: string | null, clientId: string) {
  if (!contactId) return true;
  const c = await prisma.clientContact.findUnique({ where: { id: contactId }, select: { clientId: true } });
  return !!c && c.clientId === clientId;
}

export async function createQuotationAction(formData: FormData) {
  await requireWrite("sales.quotations");
  await requirePermission("sales.quotations", "create");
  assertContactsValid(formData);
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

  const lines = parseLines(formData.get("linesJson"));
  if (lines.length === 0) return;
  const header = readHeader(formData);
  if (!(await contactOk(header.contactId, clientId))) return;
  const adjustments = readAdjustments(formData.get("adjustmentsJson"));

  const quotationNumber = await nextQuotationNumber();
  const created = await prisma.quotation.create({
    data: {
      quotationNumber,
      clientId,
      enquiryId,
      branchId,
      createdById: user.id,
      ...header,
      adjustments,
      lines: { create: lines.map((l) => ({ ...l, costBreakdown: l.costBreakdown ?? undefined })) },
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
  await logSalesActivity({ quotationId: created.id, enquiryId: undefined, kind: "CREATED", body: enquiryId ? "Created from the enquiry" : "Created", user, branchId });

  await clearDraft(user.id, "QUOTATION", enquiryId || "new");
  revalidatePath("/sales");
  revalidatePath("/sales/quotations");
  redirect(`/sales/quotations/${created.id}`);
}

const EDITABLE = ["DRAFT", "SENT", "NEGOTIATION"];

/**
 * Edits a quotation. A draft is edited in place. Once it has gone out, a change is a revision:
 * the previous version is kept, the version number goes up and the activity says what moved.
 */
export async function updateQuotationAction(formData: FormData) {
  await requireWrite("sales.quotations");
  await requirePermission("sales.quotations", "edit");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("quotationId") || "");
  if (!id) return;
  if (!(await assertQuotationInBranch(id, branchId, isSuperAdmin))) return;

  const before = await prisma.quotation.findUnique({ where: { id }, include: { lines: true } });
  if (!before || !EDITABLE.includes(before.status)) return;

  const lines = parseLines(formData.get("linesJson"));
  if (lines.length === 0) return;
  const header = readHeader(formData);
  if (!(await contactOk(header.contactId, before.clientId))) return;
  const adjustments = readAdjustments(formData.get("adjustmentsJson"));
  const revise = before.status !== "DRAFT";
  const note = stringOrNull(formData.get("revisionNote"));

  const summary = revise ? describeChanges(before.lines, lines) : null;

  await prisma.$transaction(async (tx) => {
    if (revise) {
      await tx.quotationRevision.create({
        data: {
          quotationId: id,
          version: before.version,
          createdByName: user.name,
          note,
          snapshot: JSON.parse(JSON.stringify({
            validUntil: before.validUntil,
            terms: before.terms,
            accommodationResponsibility: before.accommodationResponsibility,
            transportationResponsibility: before.transportationResponsibility,
            ppeResponsibility: before.ppeResponsibility,
            currency: before.currency,
            adjustments: before.adjustments,
            lines: before.lines,
          })),
        },
      });
    }
    await tx.quotationLine.deleteMany({ where: { quotationId: id } });
    await tx.quotation.update({
      where: { id },
      data: {
        ...header,
        adjustments,
        version: revise ? before.version + 1 : before.version,
        lines: { create: lines.map((l) => ({ ...l, costBreakdown: l.costBreakdown ?? undefined })) },
      },
    });
  });

  await logAudit({
    entityType: "QUOTATION",
    entityId: id,
    action: "UPDATE",
    before: { version: before.version, lines: before.lines } as unknown as Record<string, unknown>,
    after: { lines } as unknown as Record<string, unknown>,
    userId: user.id,
    userName: user.name,
    branchId,
  });
  if (revise) {
    await logSalesActivity({ quotationId: id, kind: "REVISION", body: `Revised to v${before.version + 1}${summary ? `: ${summary}` : ""}${note ? `. ${note}` : ""}`, user, branchId });
  }

  revalidatePath(`/sales/quotations/${id}`);
  revalidatePath("/sales/quotations");
  revalidatePath("/sales");
  redirect(`/sales/quotations/${id}`);
}

/** A short line on what a revision changed: rates that moved, trades added or dropped. */
function describeChanges(
  old: { trade: string; quantity: number; rate: number; unit: string }[],
  next: { trade: string; quantity: number; rate: number; unit: string }[],
): string {
  const bits: string[] = [];
  for (const n of next) {
    const o = old.find((x) => x.trade === n.trade);
    if (!o) bits.push(`added ${n.quantity} ${n.trade}`);
    else {
      if (o.rate !== n.rate) bits.push(`${n.trade} rate ${o.rate} → ${n.rate}`);
      if (o.quantity !== n.quantity) bits.push(`${n.trade} quantity ${o.quantity} → ${n.quantity}`);
    }
  }
  for (const o of old) if (!next.some((n) => n.trade === o.trade)) bits.push(`removed ${o.trade}`);
  return bits.slice(0, 4).join(", ");
}

/**
 * Records that the quotation went to the client, with how it was printed. Moves a draft to
 * Sent; a quotation already sent stays where it is and just logs the new send.
 */
export async function markQuotationSentAction(
  quotationId: string,
  how: { paper: "LETTERHEAD" | "PLAIN"; layout: string; via: "MARKED" | "DOWNLOADED" },
): Promise<{ error?: string }> {
  await requireWrite("sales.quotations");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!(await assertQuotationInBranch(quotationId, branchId, isSuperAdmin))) return { error: "You can't change that quotation." };
  const q = await prisma.quotation.findUnique({ where: { id: quotationId }, select: { status: true, version: true } });
  if (!q) return { error: "Quotation not found." };
  if (!["DRAFT", "SENT", "NEGOTIATION"].includes(q.status)) return { error: "This quotation is already past the sending stage." };

  await prisma.quotation.update({ where: { id: quotationId }, data: { sentAt: new Date(), ...(q.status === "DRAFT" ? { status: "SENT" } : {}) } });
  await logSalesActivity({
    quotationId,
    kind: "SENT",
    body: `${how.via === "DOWNLOADED" ? "Downloaded the PDF to send" : "Marked as sent"} · v${q.version} · ${how.paper === "LETTERHEAD" ? "on letterhead" : "plain paper"} · ${how.layout}`,
    user,
    branchId,
  });
  await logAudit({ entityType: "QUOTATION", entityId: quotationId, action: "UPDATE", before: { status: q.status }, after: { status: q.status === "DRAFT" ? "SENT" : q.status, sent: how }, userId: user.id, userName: user.name, branchId });
  revalidatePath(`/sales/quotations/${quotationId}`);
  revalidatePath("/sales/quotations");
  revalidatePath("/sales");
  return {};
}

export async function updateQuotationStatusAction(formData: FormData) {
  await requireWrite("sales.quotations");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("quotationId") || "");
  const toStatus = String(formData.get("status") || "");
  if (!id || !toStatus) return;
  if (!(await assertQuotationInBranch(id, branchId, isSuperAdmin))) return;

  const before = await prisma.quotation.findUnique({ where: { id } });
  if (!before || !QUOTATION_TRANSITIONS[before.status]?.includes(toStatus)) return;

  await prisma.quotation.update({ where: { id }, data: { status: toStatus, ...(toStatus === "SENT" ? { sentAt: new Date() } : {}) } });

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
  await logSalesActivity({ quotationId: id, kind: "STATUS", body: `${before.status.charAt(0) + before.status.slice(1).toLowerCase()} → ${toStatus.charAt(0) + toStatus.slice(1).toLowerCase()}`, user, branchId });

  revalidatePath(`/sales/quotations/${id}`);
  revalidatePath("/sales/quotations");
  revalidatePath("/sales");
}

// Converts an ACCEPTED quotation into a real Project (minimal-fields shape,
// mirroring createProjectAction), then marks the quotation CONVERTED.
// Creating an Lpo per line is optional — checked explicitly on the form,
// since not every accepted quotation arrives with firm LPO terms yet.
export async function convertQuotationToProjectAction(formData: FormData) {
  await requireWrite("sales.quotations");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("quotationId") || "");
  const createLpos = formData.get("createLpos") === "on";
  const createDemand = formData.get("createDemand") === "on";
  if (!id || !branchId) return;
  if (!(await assertQuotationInBranch(id, branchId, isSuperAdmin))) return;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { lines: true, client: true },
  });
  if (!quotation || quotation.status !== "ACCEPTED") return;

  const projectCode = nextCode("PRJ", 3, (await prisma.project.findMany({ select: { code: true } })).map((p) => p.code));

  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        code: projectCode,
        name: `${quotation.client.name}: ${quotation.quotationNumber}`,
        clientId: quotation.clientId,
        branchId: branchId!,
        status: "PLANNING",
      },
    });

    if (createLpos) {
      for (const line of quotation.lines) {
        const lpoNumber = nextCode("LPO-", 6, (await tx.lpo.findMany({ where: { lpoNumber: { startsWith: "LPO-" } }, select: { lpoNumber: true } })).map((l) => l.lpoNumber));
        await tx.lpo.create({
          data: {
            lpoNumber,
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

    // The labour request for the workers just sold, so nobody retypes the lines.
    let demandId: string | null = null;
    if (createDemand) {
      const skillIds = new Map<string, string>();
      for (const name of new Set(quotation.lines.map((l) => l.trade.trim()))) {
        skillIds.set(name.toLowerCase(), (await getOrCreateSkill(name, branchId!, tx)).id);
      }
      const demand = await tx.demandRequest.create({
        data: {
          clientId: quotation.clientId,
          projectId: project.id,
          branchId: branchId!,
          requestType: "New",
          remarks: `From quotation ${quotation.quotationNumber}`,
          requestedById: user.id,
          trades: {
            create: quotation.lines.map((l) => ({ trade: l.trade.trim(), skillId: skillIds.get(l.trade.trim().toLowerCase()), quantity: Math.max(1, Math.round(l.quantity)) })),
          },
        },
      });
      demandId = demand.id;
    }

    return { ...project, demandId };
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

  await logSalesActivity({ quotationId: id, kind: "STATUS", body: `Converted to project ${projectCode}${result.demandId ? " and a labour demand was raised" : ""}`, user, branchId });
  revalidatePath(`/sales/quotations/${id}`);
  revalidatePath("/projects");
  revalidatePath("/sales");
  if (result.demandId) revalidatePath("/demand");
  redirect(result.demandId ? `/demand/${result.demandId}` : `/projects/${result.id}`);
}

export async function deleteQuotationAction(formData: FormData) {
  await requireWrite("sales.quotations");
  assertContactsValid(formData);
  await requirePermission("sales.quotations", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("quotationId") || "");
  if (!id) return;
  if (!(await assertQuotationInBranch(id, branchId, isSuperAdmin))) return;

  const before = await prisma.quotation.findUnique({ where: { id } });
  if (!before) return;

  // Once a quotation has become a project it's the origin record for real
  // work, so it stays — reject it instead if it's no longer wanted.
  if (before.projectId || before.status === "CONVERTED") {
    redirect(
      `/sales/quotations?error=${encodeURIComponent(
        "Can't delete: this quotation was already converted into a project."
      )}`
    );
  }

  // Lines cascade from the schema.
  await prisma.quotation.delete({ where: { id } });

  await logAudit({
    entityType: "QUOTATION",
    entityId: id,
    action: "DELETE",
    before: before as unknown as Record<string, unknown>,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/sales/quotations");
}

/** Board drag-and-drop: same rules as updateQuotationStatusAction, but reports why a move was refused. */
export async function moveQuotationAction(id: string, toStatus: string): Promise<{ error?: string }> {
  await requireWrite("sales.quotations");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!(await assertQuotationInBranch(id, branchId, isSuperAdmin))) return { error: "You can't change that quotation." };
  const before = await prisma.quotation.findUnique({ where: { id } });
  if (!before) return { error: "Quotation not found." };
  if (!QUOTATION_TRANSITIONS[before.status]?.includes(toStatus)) return { error: `A ${before.status.toLowerCase()} quotation can't move to ${toStatus.toLowerCase()}.` };
  await prisma.quotation.update({ where: { id }, data: { status: toStatus, ...(toStatus === "SENT" ? { sentAt: new Date() } : {}) } });
  await logAudit({ entityType: "QUOTATION", entityId: id, action: "UPDATE", before: { status: before.status }, after: { status: toStatus }, userId: user.id, userName: user.name, branchId });
  await logSalesActivity({ quotationId: id, kind: "STATUS", body: `${before.status.charAt(0) + before.status.slice(1).toLowerCase()} → ${toStatus.charAt(0) + toStatus.slice(1).toLowerCase()}`, user, branchId });
  revalidatePath("/sales");
  revalidatePath("/sales/quotations");
  revalidatePath(`/sales/quotations/${id}`);
  return {};
}
