"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

async function assertBankInBranch(bankId: string, branchId: string | null, isSuperAdmin: boolean) {
  const bank = await prisma.bank.findUnique({ where: { id: bankId }, select: { branchId: true } });
  return !!bank && !isOutsideBranch(bank.branchId, branchId, isSuperAdmin);
}

export async function createBankAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const accountName = String(formData.get("accountName") || "").trim();
  const bankName = String(formData.get("bankName") || "").trim();
  if (!accountName || !bankName) return;

  if (!branchId) {
    redirect(
      `/banks?error=${encodeURIComponent(
        isSuperAdmin
          ? "Pick a branch from the switcher before adding a bank."
          : "Your account has no branch assigned — contact an admin."
      )}`
    );
  }

  await prisma.bank.create({ data: { accountName, bankName, branchId } });
  revalidatePath("/banks");
}

export async function updateBankAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("bankId") || "");
  if (!id) return;
  if (!(await assertBankInBranch(id, branchId, isSuperAdmin))) return;

  const accountName = String(formData.get("accountName") || "").trim();
  const bankName = String(formData.get("bankName") || "").trim();
  if (!accountName || !bankName) return;

  await prisma.bank.update({
    where: { id },
    data: {
      accountName,
      bankName,
      abbreviation: stringOrNull(formData.get("abbreviation")),
      accountNo: stringOrNull(formData.get("accountNo")),
      ibanNo: stringOrNull(formData.get("ibanNo")),
      routingCode: stringOrNull(formData.get("routingCode")),
      swiftCode: stringOrNull(formData.get("swiftCode")),
      bankBranch: stringOrNull(formData.get("bankBranch")),
      address: stringOrNull(formData.get("address")),
      remarks: stringOrNull(formData.get("remarks")),
      status: String(formData.get("status") || "ACTIVE"),
    },
  });

  revalidatePath(`/banks/${id}`);
  revalidatePath("/banks");
}

export async function deleteBankAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("bankId") || "");
  if (!id) return;
  if (!(await assertBankInBranch(id, branchId, isSuperAdmin))) return;

  await prisma.bank.delete({ where: { id } });

  revalidatePath("/banks");
}
