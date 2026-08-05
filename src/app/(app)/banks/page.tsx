import { prisma } from "@/lib/db";
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
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Banks</h1>
        <p className="mt-1 text-sm text-slate-500">
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
        className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4"
      >
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Account name
          </span>
          <input
            name="accountName"
            required
            placeholder="e.g. Main Operating Account"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Bank name
          </span>
          <input
            name="bankName"
            required
            placeholder="e.g. Emirates NBD"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90"
        >
          + Add Bank
        </button>
      </form>

      {banks.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No banks yet. Add one above.
        </p>
      ) : (
        <BankList banks={banks} />
      )}
    </div>
  );
}
