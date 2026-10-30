"use client";

import Link from "next/link";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { optionsOf } from "@/components/data-table/filterOptions";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteBankAction } from "./actions";

export type BankRow = {
  id: string; accountName: string; bankName: string; accountNo: string | null; ibanNo: string | null; currency: string; company: string | null;
  state: "ACTIVE" | "INCOMPLETE" | "DISABLED"; missing: string[];
};

const LABEL = { ACTIVE: "Active", INCOMPLETE: "Incomplete", DISABLED: "Switched off" } as const;
const COLOR = { ACTIVE: "green", INCOMPLETE: "amber", DISABLED: "slate" } as const;

export function BankList({ banks }: { banks: BankRow[] }) {
  const columns: DataTableColumn<BankRow>[] = [
    { key: "accountName", header: "Account", render: (b) => (<><Link href={`/banks/${b.id}`} className="font-medium text-primary hover:underline">{b.accountName}</Link><span className="block text-xs text-muted">{b.bankName}</span></>), csvValue: (b) => `${b.accountName}: ${b.bankName}` },
    { key: "company", header: "Company", render: (b) => b.company || <span className="text-subtle">—</span>, csvValue: (b) => b.company },
    { key: "accountNo", header: "Account no.", render: (b) => b.accountNo || <span className="text-subtle">—</span>, csvValue: (b) => b.accountNo },
    { key: "ibanNo", header: "IBAN", render: (b) => b.ibanNo || <span className="text-subtle">—</span>, csvValue: (b) => b.ibanNo },
    { key: "currency", header: "Currency", render: (b) => b.currency, csvValue: (b) => b.currency },
    {
      key: "state", header: "Status",
      render: (b) => (
        <span className="flex flex-col items-start gap-1">
          <Badge color={COLOR[b.state]} dot>{LABEL[b.state]}</Badge>
          {b.state === "INCOMPLETE" && <span className="text-[11px] text-muted">Add: {b.missing.join(", ")}</span>}
        </span>
      ),
      csvValue: (b) => LABEL[b.state],
    },
  ];
  return (
    <DataTable
      rows={banks}
      columns={columns}
      rowHref={(b) => `/banks/${b.id}`}
      csvFilename={`banks-${new Date().toISOString().slice(0, 10)}.csv`}
      filters={[
        { key: "status", label: "All statuses", options: (Object.keys(LABEL) as (keyof typeof LABEL)[]).map((v) => ({ value: v, label: LABEL[v] })), get: (b) => b.state },
        { key: "company", label: "All companies", options: optionsOf(banks, (b) => b.company), get: (b) => b.company },
        { key: "bank", label: "All banks", options: optionsOf(banks, (b) => b.bankName), get: (b) => b.bankName },
        { key: "currency", label: "All currencies", options: optionsOf(banks, (b) => b.currency), get: (b) => b.currency },
      ]}
      renderRowActions={(b) => <DeleteButton action={deleteBankAction} hiddenFields={{ bankId: b.id }} confirmMessage={`Delete bank "${b.accountName}"?`} />}
    />
  );
}
