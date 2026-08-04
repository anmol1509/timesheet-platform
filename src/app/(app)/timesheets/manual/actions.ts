"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { importParsedMonths } from "@/lib/importTimesheet";
import type { DailyHourCell, ParsedEntry, ParsedMonth } from "@/lib/parseTimesheet";

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ManualRow = {
  employeeIdNo: string;
  employeeName: string;
  trade: string;
  rate: string;
  supplierName: string;
  clientName: string;
  site: string;
  days: string[];
};

function monthLabelFromKey(month: string) {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date
    .toLocaleDateString("en-US", { month: "short", year: "2-digit" })
    .replace(" ", "-")
    .toUpperCase();
}

export async function submitManualEntryAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) {
    return {
      error: isSuperAdmin
        ? "Pick a branch from the switcher before adding a manual entry."
        : "Your account has no branch assigned — contact an admin.",
    };
  }

  const month = String(formData.get("month") || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { error: "Pick a valid month." };
  }
  const projectId = String(formData.get("projectId") || "").trim() || null;

  let rows: ManualRow[];
  try {
    rows = JSON.parse(String(formData.get("rowsJson") || "[]"));
  } catch {
    return { error: "Could not read the entered rows." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "Add at least one employee row." };
  }

  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const entries: ParsedEntry[] = [];
  for (const [i, row] of rows.entries()) {
    const employeeIdNo = (row.employeeIdNo || "").trim();
    const employeeName = (row.employeeName || "").trim();
    const supplierName = (row.supplierName || "").trim();
    const trade = (row.trade || "").trim();
    const rate = Number(row.rate);

    if (!employeeIdNo || !employeeName || !supplierName || !trade) {
      return {
        error: `Row ${i + 1}: ID, name, trade, and supplier are all required.`,
      };
    }
    if (!Number.isFinite(rate) || rate < 0) {
      return { error: `Row ${i + 1}: rate must be a valid number.` };
    }

    const dailyHours: DailyHourCell[] = [];
    let totalHours = 0;
    let absentCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const raw = (row.days?.[d - 1] || "").trim();
      const num = raw === "" ? null : Number(raw);
      const date = new Date(Date.UTC(year, monthNum - 1, d));
      const label = WEEKDAY_ABBR[date.getUTCDay()];
      if (raw !== "" && num != null && Number.isFinite(num)) {
        totalHours += num;
      } else if (/^a$/i.test(raw)) {
        absentCount++;
      }
      dailyHours.push({
        date: date.toISOString().slice(0, 10),
        label,
        value: num != null && Number.isFinite(num) ? String(num) : raw,
      });
    }

    entries.push({
      employeeIdNo,
      employeeName,
      supplierName,
      clientName: (row.clientName || "").trim() || null,
      site: (row.site || "").trim() || null,
      trade,
      rate,
      dailyHours,
      totalHours,
      absentCount,
      invoiceValue: rate * totalHours,
    });
  }

  const monthLabel = monthLabelFromKey(month);
  const parsedMonth: ParsedMonth = {
    sheetName: "Manual Entry",
    month,
    monthLabel,
    entries,
    skippedRows: 0,
    skippedRowDetails: [],
  };

  const upload = await prisma.upload.create({
    data: {
      filename: `Manual Entry — ${monthLabel}`,
      fileData: null,
      uploadedById: user.id,
      branchId,
    },
  });

  await importParsedMonths([parsedMonth], upload.id, branchId, projectId);

  revalidatePath("/upload");
  revalidatePath("/history");
  revalidatePath("/employees");
  redirect(`/upload/${upload.id}`);
}
