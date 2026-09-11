import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { generateCheckInPdf } from "@/lib/generateCheckInPdf";

const CAMP_TYPE_LABEL: Record<string, string> = { OWN: "Own", SUPPLIER: "Supplier" };
const STATUS_LABEL: Record<string, string> = {
  CHECKED_IN: "Checked In",
  BED_ALLOCATED: "Bed Allocated",
  CHECKED_OUT: "Checked Out",
};

export async function GET(request: Request) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const ids = new URL(request.url).searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No check-ins specified." }, { status: 400 });
  }

  const checkIns = await prisma.campCheckIn.findMany({
    where: { id: { in: ids } },
    include: {
      employee: { select: { name: true, nationality: true, branchId: true, supplier: true, project: { select: { code: true, name: true } } } },
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

  const buffer = await generateCheckInPdf({
    branchName: branch?.name ?? "Burj Al Aweer",
    branchAddress: branch?.address ?? null,
    campName: visible[0].camp.name,
    campType: CAMP_TYPE_LABEL[visible[0].camp.ownerType] ?? visible[0].camp.ownerType,
    date: visible[0].checkInDate.toLocaleDateString("en-GB"),
    rows: visible.map((c, i) => ({
      slNo: i + 1,
      checkInNo: `CHK-${String(c.checkInNo).padStart(5, "0")}`,
      employeeName: c.employee.name,
      nationality: c.employee.nationality,
      projectName: c.employee.project
        ? `${c.employee.project.name}${c.employee.project.code ? ` (${c.employee.project.code})` : ""}`
        : null,
      supplierName: c.employee.supplier
        ? `${c.employee.supplier.name}${c.employee.supplier.code ? ` (${c.employee.supplier.code})` : ""}`
        : null,
      coordinator: c.employee.supplier?.coordinatorName ?? null,
      status: STATUS_LABEL[c.status] ?? c.status,
    })),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="check-in-list-${visible[0].camp.name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
