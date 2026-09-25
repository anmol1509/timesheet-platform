import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { BankForm } from "../bank-form";
import { deleteBankAction } from "../actions";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { bankState } from "@/lib/bankStatus";

export default async function BankDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const bank = await prisma.bank.findUnique({ where: { id } });
  if (!bank || isOutsideBranch(bank.branchId, branchId, isSuperAdmin)) notFound();
  const companies = await prisma.supplier.findMany({ where: { branchId: bank.branchId, isOwnCompany: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const st = bankState(bank);
  const label = { ACTIVE: "Active", INCOMPLETE: "Incomplete", DISABLED: "Switched off" }[st.state];
  const color = { ACTIVE: "green", INCOMPLETE: "amber", DISABLED: "slate" }[st.state] as "green" | "amber" | "slate";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/banks" className="text-sm text-muted hover:underline">← Banks</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-primary">{bank.accountName}</h1>
            <Badge color={color} dot>{label}</Badge>
          </div>
          <DeleteButton action={deleteBankAction} hiddenFields={{ bankId: bank.id }} confirmMessage={`Delete bank "${bank.accountName}"?`} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50" />
        </div>
        <p className="mt-1 text-sm text-muted">{bank.bankName}</p>
      </div>

      <div className={`card flex gap-3 p-4 text-sm ${st.state === "INCOMPLETE" ? "border-[var(--warning-border)] bg-[var(--warning-soft)]" : ""}`}>
        {st.state === "ACTIVE" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />}
        <p className="text-secondary">
          {st.state === "ACTIVE" && "This account is complete and can be used for salary payments and recording payments."}
          {st.state === "INCOMPLETE" && <>Not usable yet. Add: <span className="font-medium text-primary">{st.missing.join(", ")}</span>. It becomes active as soon as they are saved.</>}
          {st.state === "DISABLED" && "This account has been switched off. Tick “Account is in use” below to turn it back on (it also needs its account number and IBAN)."}
        </p>
      </div>

      <div className="card p-5">
        <BankForm
          companies={companies}
          initial={{
            id: bank.id, accountName: bank.accountName, bankName: bank.bankName, abbreviation: bank.abbreviation ?? "", accountType: bank.accountType ?? "CURRENT", currency: bank.currency,
            companyId: bank.companyId ?? "", accountNo: bank.accountNo ?? "", ibanNo: bank.ibanNo ?? "", routingCode: bank.routingCode ?? "", swiftCode: bank.swiftCode ?? "",
            bankBranch: bank.bankBranch ?? "", address: bank.address ?? "", contactPerson: bank.contactPerson ?? "", contactPhone: bank.contactPhone ?? "", contactEmail: bank.contactEmail ?? "",
            remarks: bank.remarks ?? "", enabled: bank.status !== "INACTIVE",
          }}
        />
      </div>
    </div>
  );
}
