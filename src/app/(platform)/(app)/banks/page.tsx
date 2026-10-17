import { prisma } from "@/lib/db";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { HeroHeader, heroButton } from "@/components/HeroHeader";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { bankState } from "@/lib/bankStatus";
import { AddBank } from "./add-bank";
import { BankList, type BankRow } from "./bank-list";

export const metadata = { title: "Banks" };

export default async function BanksPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const [banks, companies] = await Promise.all([
    prisma.bank.findMany({ where: branchWhere(branchId), include: { company: { select: { name: true } } }, orderBy: { accountName: "asc" } }),
    branchId ? prisma.supplier.findMany({ where: { branchId, isOwnCompany: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  const rows: BankRow[] = banks.map((b) => {
    const st = bankState(b);
    return { id: b.id, accountName: b.accountName, bankName: b.bankName, accountNo: b.accountNo, ibanNo: b.ibanNo, currency: b.currency, company: b.company?.name ?? null, state: st.state, missing: st.missing };
  });
  const active = rows.filter((r) => r.state === "ACTIVE").length;
  const incomplete = rows.filter((r) => r.state === "INCOMPLETE").length;

  return (
    <div className="space-y-5">
      <HeroHeader
        icon={Wallet}
        title="Banks"
        subtitle="The accounts you pay salaries and suppliers from. An account is usable once its account number and a valid IBAN are entered."
        pills={[
          { label: "Accounts", value: String(rows.length) },
          { label: "Active", value: String(active) },
          { label: "Incomplete", value: String(incomplete), warn: incomplete > 0 },
        ]}
        actions={branchId && can(subject, "partners.banks", "create") ? <AddBank companies={companies} triggerClassName={`${heroButton(true)} cursor-pointer`} /> : undefined}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Wallet} title="No bank accounts yet" description="Add the accounts you pay salaries and suppliers from. They are used for the WPS salary file and for recording payments." />
      ) : (
        <BankList banks={rows} />
      )}
    </div>
  );
}
