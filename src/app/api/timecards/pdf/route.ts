import { NextResponse } from "next/server";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { buildLetterhead, imageIsReadable } from "@/lib/letterhead";
import { generateTimeCardPdf, type TimeCardMode, type TimeCardPage } from "@/lib/generateTimeCardPdf";
import { readTimeCardSpec } from "@/lib/timeCard";
import { loadCardWorkers, loadCompanyCards, sampleCardWorker } from "@/lib/timeCardData";

/** A short page the person can read, since this opens in a new tab from the print dialog. */
function problem(message: string, status = 400) {
  const esc = message.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return new NextResponse(`<!doctype html><meta charset="utf-8"><title>Time cards</title><body style="font:16px system-ui;max-width:34rem;margin:15vh auto;padding:0 1rem;color:#1e293b"><h1 style="font-size:20px">The time cards could not be made</h1><p>${esc}</p><p><a href="javascript:window.close()">Close this tab</a></p></body>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/**
 * Time cards as a PDF, one card per worker, each with the name, logo and (for the whole-card option) the pre-printed card of the
 * worker's own company.
 *   ?idNos=A,B,C  the workers' ID numbers        ?month=2026-10
 *   ?mode=artwork|overprint|template             ?paper=card|a4
 *   ?fill=header|full                            ?inout=blank|standard
 *   ?pay=1                                       pay figures (needs payroll access)
 *   ?preview=1                                   a made-up worker, for the template editor
 *   ?companyId=...                               with preview: that company's own header, card and template
 */
export async function GET(request: Request) {
  const { user, branchId } = await requireUserWithBranch();
  if (!can(subjectOf(user), "timesheets.client-timesheet", "view")) return problem("You don't have access to timesheets.", 403);
  const q = new URL(request.url).searchParams;
  const month = /^\d{4}-\d{2}$/.test(q.get("month") ?? "") ? (q.get("month") as string) : new Date().toISOString().slice(0, 7);
  const mode: TimeCardMode = q.get("mode") === "artwork" ? "artwork" : q.get("mode") === "template" ? "template" : "overprint";
  const paper = q.get("paper") === "a4" ? "a4" : "card";
  const filled = q.get("fill") === "full";
  const inOut = q.get("inout") === "standard" ? "standard" : "blank";
  const showPay = q.get("pay") === "1" && can(subjectOf(user), "payroll", "view");
  const preview = q.get("preview") === "1";

  const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId } }) : null;
  if (!branch) return problem("Choose a company first.");
  const sharedSpec = readTimeCardSpec(branch.timeCardSpec);

  // The company profile's own header and card: used for the preview, and for a worker who has no company of ours.
  const profileLetterhead = await buildLetterhead({ name: branch.name, address: branch.address, emirate: branch.emirate, country: branch.country, phone: branch.phone, fax: branch.fax, email: branch.email, poBox: branch.poBox, trn: branch.trn, logoId: branch.logoId });
  let profileArtwork: string | null = null;
  if (mode === "artwork") {
    const img = branch.timeCardImageId ? await prisma.storedImage.findUnique({ where: { id: branch.timeCardImageId } }) : null;
    if (img && /^image\/(png|jpe?g)$/i.test(img.mimeType) && imageIsReadable(img.data, img.mimeType)) profileArtwork = `data:${img.mimeType};base64,${Buffer.from(img.data).toString("base64")}`;
  }

  let pages: TimeCardPage[];
  if (preview) {
    // A company's own preview uses its header, its card and its own template (or the shared one).
    const companyId = q.get("companyId");
    const company = companyId ? (await loadCompanyCards([companyId], mode === "artwork", sharedSpec)).get(companyId) : null;
    if (companyId && !company) return problem("Company not found.");
    const spec = company?.spec ?? sharedSpec;
    const sample = sampleCardWorker(month);
    if (!filled) Object.assign(sample, { days: sample.days.map((d) => ({ ...d, shift: false, overtime: "", total: "" })), totals: { days: 0, hours: "0", overtimeHours: "0" }, money: null });
    const artwork = company ? company.artwork : profileArtwork;
    if (mode === "artwork" && !artwork) return problem(company ? `${company.name} has no usable time card yet (a JPG or PNG on its company page, under "Letterhead and time card").` : "Upload the default time card first (Settings → Company profile → Time card).");
    pages = [{ worker: sample, artwork, letterhead: company?.letterhead ?? profileLetterhead, spec }];
  } else {
    const idNos = (q.get("idNos") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 300);
    const workers = await loadCardWorkers({ branchId, idNos, month, filled, inOut, showPay });
    if (workers.length === 0) return problem("Choose at least one worker.");
    const cards = await loadCompanyCards(workers.map((w) => w.companyId).filter((x): x is string => !!x), mode === "artwork", sharedSpec);
    if (mode === "artwork") {
      // A card is only printed from its own company's picture: another company's card under their name would be wrong.
      const missing = new Set<string>();
      let noCompanyWithoutDefault = false;
      for (const w of workers) {
        if (w.companyId) { const c = cards.get(w.companyId); if (!c?.artwork) missing.add(c ? `${c.name}${c.unusable ? " (the file on record is not a JPG or PNG)" : ""}` : w.companyName || "a company"); }
        else if (!profileArtwork) noCompanyWithoutDefault = true;
      }
      if (missing.size > 0 || noCompanyWithoutDefault) {
        return problem(`No usable time card is on file for: ${[...missing, ...(noCompanyWithoutDefault ? ["workers with no company of their own (the default card in Settings → Company profile → Time card)"] : [])].join("; ")}. Upload each company's blank card as a JPG or PNG on its company page, under "Letterhead and time card", or choose another way to print.`);
      }
    }
    pages = workers.map((w) => {
      const c = w.companyId ? cards.get(w.companyId) : null;
      return { worker: w, artwork: c?.artwork ?? profileArtwork, letterhead: c?.letterhead ?? profileLetterhead, spec: c?.spec ?? sharedSpec };
    });
  }

  const buffer = await generateTimeCardPdf({ mode, paper, pages });
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="time-cards-${month}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
