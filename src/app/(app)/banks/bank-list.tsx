"use client";

import Link from "next/link";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteBankAction } from "./actions";

type BankRow = {
  id: string;
  accountName: string;
  bankName: string;
  accountNo: string | null;
  ibanNo: string | null;
  swiftCode: string | null;
  status: string;
};

export function BankList({ banks }: { banks: BankRow[] }) {
  const columns: DataTableColumn<BankRow>[] = [
    {
      key: "accountName",
      header: "Account Name",
      render: (b) => (
        <Link href={`/banks/${b.id}`} className="font-medium text-primary hover:underline">
          {b.accountName}
        </Link>
      ),
      csvValue: (b) => b.accountName,
    },
    {
      key: "bankName",
      header: "Bank Name",
      render: (b) => b.bankName,
      csvValue: (b) => b.bankName,
    },
    {
      key: "accountNo",
      header: "Account No",
      render: (b) => b.accountNo || "—",
      csvValue: (b) => b.accountNo,
    },
    {
      key: "ibanNo",
      header: "IBAN No",
      render: (b) => b.ibanNo || "—",
      csvValue: (b) => b.ibanNo,
    },
    {
      key: "swiftCode",
      header: "Swift Code",
      render: (b) => b.swiftCode || "—",
      csvValue: (b) => b.swiftCode,
    },
    {
      key: "status",
      header: "Status",
      render: (b) => <Badge color={b.status === "ACTIVE" ? "green" : "red"}>{b.status}</Badge>,
      csvValue: (b) => b.status,
    },
  ];

  return (
    <DataTable
      rows={banks}
      columns={columns}
      rowHref={(b) => `/banks/${b.id}`}
      csvFilename={`banks-${new Date().toISOString().slice(0, 10)}.csv`}
      renderRowActions={(b) => (
        <DeleteButton
          action={deleteBankAction}
          hiddenFields={{ bankId: b.id }}
          confirmMessage={`Delete bank "${b.accountName}"?`}
        />
      )}
    />
  );
}
