import { NextResponse } from "next/server";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { buildLetterhead, imageIsReadable } from "@/lib/letterhead";
import { generateTimeCardPdf, type TimeCardMode } from "@/lib/generateTimeCardPdf";
import { readTimeCardSpec } from "@/lib/timeCard";
import { loadCardWorkers, sampleCardWorker } from "@/lib/timeCardData";

/**
 * Time cards as a PDF.
 *   ?idNos=A,B,C  the workers' ID numbers        ?month=2026-10
 *   ?mode=artwork|overprint|template             ?paper=card|a4
 *   ?fill=header|full                            ?inout=blank|standard
 *   ?pay=1                                       pay figures (needs payroll access)
 *   ?preview=1                                   a made-up worker, for the template editor
 */
export async function GET(request: Request) {
  const { user, branchId } = await requireUserWithBranch();
  if (!can(subjectOf(user), "timesheets.client-timesheet", "view")) return NextResponse.json({ error: "You don't have access to timesheets." }, { status: 403 });
  const q = new URL(request.url).searchParams;
  const month = /^\d{4}-\d{2}$/.test(q.get("month") ?? "") ? (q.get("month") as string) : new Date().toISOString().slice(0, 7);
  const mode: TimeCardMode = q.get("mode") === "artwork" ? "artwork" : q.get("mode") === "template" ? "template" : "overprint";
  const paper = q.get("paper") === "a4" ? "a4" : "card";
  const filled = q.get("fill") === "full";
  const inOut = q.get("inout") === "standard" ? "standard" : "blank";
  const showPay = q.get("pay") === "1" && can(subjectOf(user), "payroll", "view");
  const preview = q.get("preview") === "1";

  const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId } }) : null;
  if (!branch) return NextResponse.json({ error: "Choose a company first." }, { status: 400 });
  const spec = readTimeCardSpec(branch.timeCardSpec);

  let artwork: string | null = null;
  if (mode === "artwork") {
    const img = branch.timeCardImageId ? await prisma.storedImage.findUnique({ where: { id: branch.timeCardImageId } }) : null;
    if (!img || !/^image\/(png|jpe?g)$/i.test(img.mimeType) || !imageIsReadable(img.data, img.mimeType)) {
      return NextResponse.json({ error: "Upload the time card first (Settings → Company profile → Time card)." }, { status: 400 });
    }
    artwork = `data:${img.mimeType};base64,${Buffer.from(img.data).toString("base64")}`;
  }

  const idNos = (q.get("idNos") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 300);
  const workers = preview
    ? [sampleCardWorker(month, spec)]
    : await loadCardWorkers({ branchId, idNos, month, filled, inOut, shiftIn: spec.shiftIn, shiftOut: spec.shiftOut, showPay });
  if (workers.length === 0) return NextResponse.json({ error: "Choose at least one worker." }, { status: 400 });
  if (preview && !filled) workers[0] = { ...workers[0], days: workers[0].days.map((d) => ({ ...d, in: "", out: "", overtime: "", total: "" })), totals: { days: 0, hours: "0", overtimeHours: "0" }, money: null };

  const letterhead = await buildLetterhead({ name: branch.name, address: branch.address, emirate: branch.emirate, country: branch.country, phone: branch.phone, fax: branch.fax, email: branch.email, poBox: branch.poBox, trn: branch.trn, logoId: branch.logoId });
  const buffer = await generateTimeCardPdf({ mode, paper, spec, artwork, letterhead, workers });
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="time-cards-${month}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
