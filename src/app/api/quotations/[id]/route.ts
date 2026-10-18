import { marginsOfBranch } from "@/lib/paperMargins";
import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { generateQuotationPdf } from "@/lib/generateQuotationPdf";
import { buildLetterhead } from "@/lib/letterhead";
import { imageDataUri } from "@/lib/storedImage";
import { parseAdjustments, parseQuoteSettings, quoteTotals } from "@/lib/quotationMath";
import { fillCoverText, STANDARD_INTRO } from "@/lib/quotationCover";

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * The quotation as a PDF. Query: paper=letterhead|plain, layout=standard|compact|<cover text id>,
 * terms, sig, stamp, ot (1/0), and inline=1 to show in the page instead of downloading.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const q = new URL(request.url).searchParams;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { client: true, branch: true, lines: true, contact: true },
  });
  if (!quotation || isOutsideBranch(quotation.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }

  const flag = (key: string, fallback: boolean) => (q.has(key) ? q.get(key) !== "0" : fallback);
  const layoutParam = q.get("layout") || "standard";
  const template =
    layoutParam !== "standard" && layoutParam !== "compact"
      ? await prisma.quotationTemplate.findUnique({ where: { id: layoutParam } })
      : null;
  if (template && template.branchId !== quotation.branchId) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  const settings = parseQuoteSettings(quotation.branch.quoteSettings);
  const adjustments = parseAdjustments(quotation.adjustments);
  const lines = quotation.lines.map((l) => ({
    trade: l.trade,
    quantity: l.quantity,
    rate: l.rate,
    otRate: l.otRate,
    nationality: l.nationality,
    workingHours: l.workingHours,
    unit: l.unit,
    unitLabel: l.unitLabel,
    unitsPerMonth: l.unitsPerMonth,
    hoursPerDay: l.hoursPerDay,
    durationMonths: l.durationMonths,
  }));
  const total = quoteTotals(lines, adjustments, settings).total;
  const facts = {
    client: quotation.client.name,
    contact: quotation.contact?.name ?? "",
    quotationNo: quotation.quotationNumber,
    date: fmtDate(new Date()),
    validUntil: quotation.validUntil ? fmtDate(quotation.validUntil) : "",
    total: `${quotation.currency} ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    company: quotation.branch.name,
  };

  const onLetterhead = q.get("paper") === "letterhead" && !!quotation.branch.letterheadImageId;
  const [letterhead, artwork, signature, stamp] = await Promise.all([
    buildLetterhead({ ...quotation.branch, logoId: quotation.branch.logoId }),
    onLetterhead ? imageDataUri(quotation.branch.letterheadImageId) : null,
    flag("sig", true) ? imageDataUri(quotation.branch.signatureId) : null,
    flag("stamp", true) ? imageDataUri(quotation.branch.stampId) : null,
  ]);

  const compact = layoutParam === "compact";
  const buffer = await generateQuotationPdf({
    letterhead,
    artwork,
    topMm: quotation.branch.letterheadTopMm,
    bottomMm: quotation.branch.letterheadBottomMm,
    margins: marginsOfBranch(quotation.branch),
    signature,
    stamp,
    signatoryName: quotation.branch.signatoryName,
    signatoryTitle: quotation.branch.signatoryTitle,
    quotationNumber: quotation.quotationNumber,
    version: quotation.version,
    date: facts.date,
    clientName: quotation.client.name,
    contactName: quotation.contact?.name ?? null,
    validUntil: facts.validUntil || null,
    currency: quotation.currency,
    terms: quotation.terms,
    accommodationResponsibility: quotation.accommodationResponsibility,
    transportationResponsibility: quotation.transportationResponsibility,
    ppeResponsibility: quotation.ppeResponsibility,
    lines,
    adjustments,
    settings,
    options: { layout: compact ? "COMPACT" : "STANDARD", showTerms: flag("terms", true), showOt: flag("ot", true) },
    // Wording written on this quotation wins over the cover text picked at send time.
    intro: quotation.coverIntro?.trim() ? fillCoverText(quotation.coverIntro, facts) : template ? fillCoverText(template.intro, facts) : compact ? null : fillCoverText(STANDARD_INTRO, facts),
    closing: quotation.coverClosing?.trim() ? fillCoverText(quotation.coverClosing, facts) : template?.closing ? fillCoverText(template.closing, facts) : null,
  });

  const inline = q.get("inline") === "1";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${quotation.quotationNumber}${quotation.version > 1 ? `-v${quotation.version}` : ""}.pdf"`,
    },
  });
}
