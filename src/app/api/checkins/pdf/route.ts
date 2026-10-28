import { parseDay } from "@/lib/dates";
import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { generateCheckInPdf } from "@/lib/generateCheckInPdf";
import { buildLetterhead } from "@/lib/letterhead";
import { checkInListWording, fillCheckInWording } from "@/lib/checkInList";

const CAMP_TYPE_LABEL: Record<string, string> = { OWN: "Own", SUPPLIER: "Supplier", CLIENT: "Client" };
const STATUS_LABEL: Record<string, string> = {
  CHECKED_IN: "Check-in Issued",
  BED_ALLOCATED: "Bed Allocated",
  CHECKED_OUT: "Checked Out",
};

export async function GET(request: Request) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const params = new URL(request.url).searchParams;
  const ids = params.get("ids")?.split(",").filter(Boolean) ?? [];
  // Optional YYYY-MM-DD for the date the document carries (today when not given).
  const issuedOn = parseDay(params.get("letterDate") ?? "") ?? new Date();
  if (ids.length === 0) {
    return NextResponse.json({ error: "No check-ins specified." }, { status: 400 });
  }

  const checkIns = await prisma.campCheckIn.findMany({
    where: { id: { in: ids } },
    include: {
      employee: { select: { name: true, employeeIdNo: true, trade: true, nationality: true, branchId: true, supplier: true } },
      camp: { select: { name: true, ownerType: true } },
    },
    orderBy: { checkInNo: "asc" },
  });

  const visible = checkIns.filter((c) => !isOutsideBranch(c.employee.branchId, branchId, isSuperAdmin));
  if (visible.length === 0) {
    return NextResponse.json({ error: "Check-ins not found." }, { status: 404 });
  }

  const letterheadBranchId = branchId ?? visible[0].branchId ?? visible[0].employee.branchId;
  const branch = letterheadBranchId ? await prisma.branch.findUnique({ where: { id: letterheadBranchId } }) : null;

  const campName = visible[0].camp.name;
  const campType = CAMP_TYPE_LABEL[visible[0].camp.ownerType] ?? visible[0].camp.ownerType;
  const checkInDate = visible[0].checkInDate.toLocaleDateString("en-GB");
  const wording = await checkInListWording(letterheadBranchId);
  const letterhead = branch
    ? await buildLetterhead(branch)
    : { name: "Workforce ERP", addressLines: [], phone: null, fax: null, email: null, poBox: null, trn: null, logo: null };

  const buffer = await generateCheckInPdf({
    letterhead,
    title: wording.title,
    date: checkInDate,
    campName,
    bodyHtml: fillCheckInWording(wording.html, {
      companyName: letterhead.name,
      campName,
      campType,
      checkInDate,
      count: visible.length,
      date: issuedOn.toLocaleDateString("en-GB", { timeZone: "UTC" }),
    }),
    rows: visible.map((c, i) => ({
      slNo: i + 1,
      checkInNo: `CHK-${String(c.checkInNo).padStart(5, "0")}`,
      employeeName: c.employee.name,
      employeeCode: c.employee.employeeIdNo,
      nationality: c.employee.nationality,
      trade: c.employee.trade,
      supplierName: c.employee.supplier?.name ?? null,
      coordinator: c.employee.supplier?.coordinatorName ?? null,
      status: STATUS_LABEL[c.status] ?? c.status,
    })),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="check-in-list-${visible[0].camp.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "camp"}.pdf"`,
    },
  });
}
