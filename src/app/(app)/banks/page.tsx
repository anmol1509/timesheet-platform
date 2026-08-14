import { prisma } from "@/lib/db";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { createBankAction } from "./actions";
import { BankList } from "./bank-list";

export default async function BanksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { branchId } = await requireUserWithBranch();
  const banks = await prisma.bank.findMany({
    where: branchWhere(branchId),
    select: {
      id: true,
      accountName: true,
      bankName: true,
      accountNo: true,
      ibanNo: true,
      swiftCode: true,
      status: true,
    },
    orderBy: { accountName: "asc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">Banks</h1>
        <p className="mt-1 text-sm text-muted">
          Manage the bank accounts referenced across payments and invoices.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form
        action={createBankAction}
        className="card flex flex-wrap items-end gap-3 p-4"
      >
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            Account name
          </span>
          <input
            name="accountName"
            required
            placeholder="e.g. Main Operating Account"
            className="input w-full"
          />
        </label>
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            Bank name
          </span>
          <input
            name="bankName"
            required
            placeholder="e.g. Emirates NBD"
            className="input w-full"
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary"
        >
          + Add Bank
        </button>
      </form>

      {banks.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No banks yet"
          description="Banks are referenced on supplier payment details and employee WPS records. Add one above to make it selectable."
        />
      ) : (
        <BankList banks={banks} />
      )}
    </div>
  );
}
