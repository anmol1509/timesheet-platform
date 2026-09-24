"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { approverIds, notifyUsers } from "@/lib/notifications/notify";
import { parseDay } from "@/lib/dates";
import { isDuplicateBill } from "@/lib/financeRules";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const money = (v: FormDataEntryValue | null) => {
  const n = Number(str(v) || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
const DAY = 86_400_000;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

type Parsed = { billNo: string; billDate: Date; periodMonth: string | null; amount: number; vatAmount: number; description: string | null; file: File | null };

function parse(formData: FormData): { error: string } | { ok: true; data: Parsed } {
  const billNo = str(formData.get("billNo"));
  const billDate = parseDay(str(formData.get("billDate")));
  const amount = money(formData.get("amount"));
  const vatAmount = money(formData.get("vatAmount"));
  const periodRaw = str(formData.get("periodMonth"));
  if (!billNo) return { error: "Enter your invoice number." };
  if (!billDate) return { error: "Enter the invoice date." };
  if (billDate.getTime() > Date.now() + DAY) return { error: "The invoice date can't be in the future." };
  if (!(amount > 0) || Number.isNaN(vatAmount) || vatAmount < 0) return { error: "Enter the invoice amount (before VAT) and VAT." };
  const f = formData.get("file");
  const file = f instanceof File && f.size > 0 ? f : null;
  if (file) {
    if (!ALLOWED.includes(file.type)) return { error: "Attach the invoice as a PDF, JPG or PNG." };
    if (file.size > MAX_UPLOAD_BYTES) return { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_UPLOAD_LABEL}.` };
  }
  return { ok: true, data: { billNo, billDate, periodMonth: /^\d{4}-\d{2}$/.test(periodRaw) ? periodRaw : null, amount, vatAmount, description: str(formData.get("description")) || null, file } };
}

async function saveFile(file: File, billId: string, supplierId: string, branchId: string) {
  await prisma.attachment.create({
    data: {
      entityType: "SUPPLIER_BILL", entityId: billId, docType: "BILL", filename: file.name, fileData: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type, branchId, uploadedBySupplierId: supplierId,
    },
  });
}

async function tellFinance(branchId: string, supplierName: string, billNo: string, total: number, resubmitted: boolean) {
  await notifyUsers({
    userIds: await approverIds("finance", branchId),
    kind: "SUPPLIER_INVOICE_SUBMITTED",
    title: `${resubmitted ? "Invoice resubmitted" : "New supplier invoice"}: AED ${total.toFixed(2)}`,
    body: `${supplierName} — invoice #${billNo}. Waiting for your approval.`,
    href: "/finance/bills?view=REVIEW",
  });
}

/** A supplier submits an invoice. It waits for approval like any bill; nothing is paid until then. */
export async function submitInvoiceAction(_prev: State, formData: FormData): Promise<State> {
  const vendor = await getVendor();
  if (!vendor) return { error: "Please sign in again." };
  if (vendor.invoiceApprovalStatus !== "Approved") return { error: "Invoicing isn't enabled for your company yet. Please contact us." };
  const p = parse(formData);
  if (!("ok" in p)) return { error: p.error };
  const d = p.data;
  if (!d.file) return { error: "Attach a copy of the invoice (PDF, JPG or PNG)." };

  if (str(formData.get("allowDuplicate")) !== "1") {
    const others = await prisma.supplierBill.findMany({ where: { supplierId: vendor.id }, select: { billNo: true, billDate: true, amount: true, vatAmount: true } });
    const dup = others.find((o) => isDuplicateBill({ billNo: d.billNo, billDate: d.billDate, amount: d.amount, vatAmount: d.vatAmount }, { billNo: o.billNo, billDate: o.billDate, amount: Number(o.amount), vatAmount: Number(o.vatAmount) }));
    if (dup) return { error: `DUPLICATE: you already submitted invoice #${dup.billNo} for the same total around the same date. Submit again if this is a different invoice.` };
  }

  let billId: string;
  try {
    const bill = await prisma.supplierBill.create({
      data: {
        supplierId: vendor.id, branchId: vendor.branchId, billNo: d.billNo, billDate: d.billDate, dueDate: new Date(d.billDate.getTime() + 30 * DAY),
        amount: d.amount, vatAmount: d.vatAmount, periodMonth: d.periodMonth, description: d.description, approvalStatus: "PENDING", submittedBySupplier: true,
      },
    });
    billId = bill.id;
  } catch {
    return { error: `You already have an invoice numbered ${d.billNo}.` };
  }
  await saveFile(d.file, billId, vendor.id, vendor.branchId);
  await tellFinance(vendor.branchId, vendor.name, d.billNo, d.amount + d.vatAmount, false);
  revalidatePath("/vendor/payments");
  revalidatePath("/vendor");
  return { error: null, ok: true };
}

/** Fix and resend an invoice that was rejected. Only rejected, unpaid invoices can be edited. */
export async function resubmitInvoiceAction(_prev: State, formData: FormData): Promise<State> {
  const vendor = await getVendor();
  if (!vendor) return { error: "Please sign in again." };
  const bill = await prisma.supplierBill.findFirst({ where: { id: str(formData.get("billId")), supplierId: vendor.id }, include: { _count: { select: { payments: true } } } });
  if (!bill) return { error: "That invoice wasn't found." };
  if (bill.approvalStatus !== "REJECTED" || bill._count.payments > 0) return { error: "Only a rejected invoice can be changed and resent." };
  const p = parse(formData);
  if (!("ok" in p)) return { error: p.error };
  const d = p.data;

  try {
    await prisma.supplierBill.update({
      where: { id: bill.id },
      data: {
        billNo: d.billNo, billDate: d.billDate, dueDate: new Date(d.billDate.getTime() + 30 * DAY), amount: d.amount, vatAmount: d.vatAmount,
        periodMonth: d.periodMonth, description: d.description, approvalStatus: "PENDING", approvalNote: null, approvedAt: null, approvedById: null,
      },
    });
  } catch {
    return { error: `You already have an invoice numbered ${d.billNo}.` };
  }
  if (d.file) await saveFile(d.file, bill.id, vendor.id, vendor.branchId);
  await tellFinance(vendor.branchId, vendor.name, d.billNo, d.amount + d.vatAmount, true);
  revalidatePath("/vendor/payments");
  revalidatePath("/vendor");
  return { error: null, ok: true };
}
