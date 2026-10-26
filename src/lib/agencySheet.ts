import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { CANDIDATE_TYPES, STAGES, asCandidateType, currentStage, daysSince, overallStatusLabel, pendingSince } from "@/lib/onboarding";
import { agencyStats } from "@/lib/agencyStats";
import { costPerJoinedHire, costTotals } from "@/lib/candidateCosts";

const dmy = (d: Date | null | undefined) => (d ? `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : "");

/** The agencies of a branch (or one of them) with everything the register and the sheets need. */
export async function loadAgencies(branchId: string | null, onlyId?: string) {
  return prisma.supplier.findMany({
    where: { ...branchWhere(branchId), isRecruitmentAgency: true, ...(onlyId ? { id: onlyId } : {}) },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, code: true, status: true, country: true, tradeLicenseNumber: true, contactPhone: true, contactEmail: true,
      agencyContacts: { select: { name: true, phone: true, email: true }, orderBy: { name: "asc" } },
      candidateOnboardings: { orderBy: { candidateNo: "asc" }, include: { costs: { select: { kind: true, amount: true, paid: true } } } },
    },
  });
}
export type LoadedAgency = Awaited<ReturnType<typeof loadAgencies>>[number];

/** What came through this agency cost in total, and per hire who joined. Money spent on dropped candidates counts too. */
export function agencySpend(a: LoadedAgency, joined: number) {
  const t = costTotals(a.candidateOnboardings.flatMap((c) => c.costs.map((x) => ({ kind: x.kind, amount: Number(x.amount), paid: x.paid }))));
  return { ...t, perJoined: costPerJoinedHire(t.total, joined) };
}

const head = (ws: ExcelJS.Worksheet) => {
  const r = ws.getRow(1);
  r.font = { bold: true };
  r.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEBFB" } }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
};

function summarySheet(wb: ExcelJS.Workbook, agencies: LoadedAgency[], showCosts: boolean) {
  const ws = wb.addWorksheet("Agencies");
  ws.addRow(["Agency", "Status", "Country", "Licence number", "Contacts", "Candidates submitted", "In progress", "Ready to join", "Overdue", "Papers pending", "Joined", "Dropped", "Success rate", "Average days to join", ...(showCosts ? ["Spent (AED)", "Owing (AED)", "Cost per joined hire (AED)"] : [])]);
  head(ws);
  for (const a of agencies) {
    const s = agencyStats(a.candidateOnboardings);
    ws.addRow([
      a.name, a.status === "ACTIVE" ? "Active" : "Blacklisted", a.country ?? "", a.tradeLicenseNumber ?? "",
      a.agencyContacts.map((c) => [c.name, c.phone, c.email].filter(Boolean).join(" / ")).join("; "),
      s.submitted, s.inProgress, s.ready, s.overdue, s.papersPending, s.joined, s.dropped,
      s.successRate === null ? "" : `${s.successRate}%`, s.avgDaysToJoin ?? "",
      ...(showCosts ? (() => { const x = agencySpend(a, s.joined); return [x.total, x.outstanding, x.perJoined ?? ""]; })() : []),
    ]);
  }
  ws.columns.forEach((c, i) => { c.width = i === 0 ? 34 : i === 4 ? 44 : 16; });
}

function candidateSheet(wb: ExcelJS.Workbook, name: string, agencies: LoadedAgency[], withAgency: boolean) {
  const ws = wb.addWorksheet(name);
  ws.addRow([
    "No.", ...(withAgency ? ["Agency"] : []), "Candidate", "Trade", "Nationality", "Type of hire", "Passport number", "Emirates ID", "Phone",
    "Status", "Current stage", "Days at stage", ...STAGES.map((s) => s.label), "Why dropped", "Added on", "Joined on",
  ]);
  head(ws);
  for (const a of agencies) {
    for (const c of a.candidateOnboardings) {
      const dropped = c.droppedAt !== null;
      const stage = !c.joined && !dropped ? currentStage(c) : null;
      const type = asCandidateType(c.candidateType);
      ws.addRow([
        c.candidateNo, ...(withAgency ? [a.name] : []), c.candidateName, c.trade ?? "", c.nationality ?? "", CANDIDATE_TYPES.find((t) => t.value === type)?.label ?? "",
        c.passportNumber ?? "", c.emiratesId ?? "", c.phone ?? "",
        overallStatusLabel({ ...c, dropped }), stage?.label ?? "", stage ? daysSince(pendingSince(c)) : "",
        ...STAGES.map((s) => (s.types.includes(type) ? (s.optional && c[s.field] === "Not Required" ? "" : c[s.field]) : "n/a")),
        c.droppedReason ?? "", dmy(c.createdAt), dmy(c.joiningDate),
      ]);
    }
  }
  ws.columns.forEach((c, i) => { c.width = i === 0 ? 7 : i < 4 + (withAgency ? 1 : 0) ? 22 : 16; });
}

/** Every agency with its numbers, plus every candidate, in one workbook: the master sheet. */
export async function masterWorkbook(agencies: LoadedAgency[], showCosts = false): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  summarySheet(wb, agencies, showCosts);
  candidateSheet(wb, "All candidates", agencies, true);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** One agency's sheet to send back: its numbers and each candidate with where they stand. */
export async function agencyWorkbook(agency: LoadedAgency, showCosts = false): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  summarySheet(wb, [agency], showCosts);
  candidateSheet(wb, "Candidates", [agency], false);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const xlsxResponse = (buffer: Buffer, filename: string) =>
  new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
