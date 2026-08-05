import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { EditBankForm } from "./edit-form";
import { deleteBankAction } from "../actions";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";

export default async function BankDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const bank = await prisma.bank.findUnique({ where: { id } });
  if (!bank || isOutsideBranch(bank.branchId, branchId, isSuperAdmin)) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/banks" className="text-sm text-slate-500 hover:underline">
          ← Banks
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {bank.accountName}
            </h1>
            <Badge color={bank.status === "ACTIVE" ? "green" : "red"}>
              {bank.status}
            </Badge>
          </div>
          <DeleteButton
            action={deleteBankAction}
            hiddenFields={{ bankId: bank.id }}
            confirmMessage={`Delete bank "${bank.accountName}"?`}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          />
        </div>
        <p className="mt-1 text-sm text-slate-500">{bank.bankName}</p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <EditBankForm
        bank={{
          id: bank.id,
          accountName: bank.accountName,
          bankName: bank.bankName,
          abbreviation: bank.abbreviation,
          accountNo: bank.accountNo,
          ibanNo: bank.ibanNo,
          routingCode: bank.routingCode,
          swiftCode: bank.swiftCode,
          bankBranch: bank.bankBranch,
          address: bank.address,
          remarks: bank.remarks,
          status: bank.status,
        }}
      />
    </div>
  );
}
