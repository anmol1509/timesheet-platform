import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseConsolidatedWorkbook } from "@/lib/parseTimesheet";
import { importParsedMonths } from "@/lib/importTimesheet";

// A consolidated sheet runs to hundreds of workers; each is several writes.
export const maxDuration = 60;

export async function POST(request: Request) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) {
    return NextResponse.json(
      {
        error: isSuperAdmin
          ? "Pick a branch from the switcher before uploading."
          : "Your account has no branch assigned — contact an admin.",
      },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json(
      { error: "Please upload an .xlsx file." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseConsolidatedWorkbook(buffer);
  } catch {
    return NextResponse.json(
      { error: "Could not read this file. Is it a valid Excel workbook?" },
      { status: 400 }
    );
  }

  if (parsed.months.length === 0) {
    return NextResponse.json(
      {
        error:
          "No recognizable month tabs found. Expected a sheet named like 'MAY-25' with an 'EMPLOYEE NAME' column.",
        unrecognizedSheets: parsed.unrecognizedSheets,
      },
      { status: 422 }
    );
  }

  const upload = await prisma.upload.create({
    data: { filename: file.name, fileData: buffer, uploadedById: user.id, branchId },
  });

  // Nothing here adds a supplier or client on its own: a name that isn't on record is reported back, and the rows
  // that need it wait. (Administrators decide on those names in Import Data, which has a review screen.)
  const stats = await importParsedMonths(parsed.months, upload.id, branchId, null, { userId: user.id, supplierChoice: { decisions: {} } });

  return NextResponse.json({
    upload: { id: upload.id, filename: file.name },
    stats,
    warnings: {
      zeroRateCount: parsed.zeroRateCount,
      zeroRateSample: parsed.zeroRateSample,
      implausibleHoursCount: parsed.implausibleHoursCount,
      implausibleHoursSample: parsed.implausibleHoursSample,
    },
  });
}
