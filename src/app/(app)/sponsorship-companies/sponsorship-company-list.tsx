"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteSponsorshipCompanyAction } from "./actions";

type SponsorshipCompanyRow = {
  id: string;
  name: string;
  shortName: string | null;
  country: string | null;
  phone: string | null;
  tradeLicenseNumber: string | null;
  employeeCount: number;
};

export function SponsorshipCompanyList({
  sponsorshipCompanies,
}: {
  sponsorshipCompanies: SponsorshipCompanyRow[];
}) {
  const columns: DataTableColumn<SponsorshipCompanyRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (c) => (
        <Link
          href={`/sponsorship-companies/${c.id}`}
          className="font-medium text-slate-900 hover:underline"
        >
          {c.name}
        </Link>
      ),
      csvValue: (c) => c.name,
    },
    {
      key: "shortName",
      header: "Short Name",
      render: (c) => c.shortName || "—",
      csvValue: (c) => c.shortName,
    },
    {
      key: "country",
      header: "Country",
      render: (c) => c.country || "—",
      csvValue: (c) => c.country,
    },
    {
      key: "phone",
      header: "Phone",
      render: (c) => c.phone || "—",
      csvValue: (c) => c.phone,
    },
    {
      key: "tradeLicenseNumber",
      header: "Trade License Number",
      render: (c) => c.tradeLicenseNumber || "—",
      csvValue: (c) => c.tradeLicenseNumber,
    },
    {
      key: "employeeCount",
      header: "Employees",
      align: "right",
      render: (c) => c.employeeCount,
      csvValue: (c) => c.employeeCount,
    },
  ];

  return (
    <DataTable
      rows={sponsorshipCompanies}
      columns={columns}
      rowHref={(c) => `/sponsorship-companies/${c.id}`}
      csvFilename={`sponsorship-companies-${new Date().toISOString().slice(0, 10)}.csv`}
      renderRowActions={(c) => (
        <DeleteButton
          action={deleteSponsorshipCompanyAction}
          hiddenFields={{ sponsorshipCompanyId: c.id }}
          confirmMessage={`Delete sponsorship company "${c.name}"?${
            c.employeeCount > 0
              ? ` It is still linked to ${c.employeeCount} employee(s).`
              : ""
          }`}
        />
      )}
    />
  );
}
