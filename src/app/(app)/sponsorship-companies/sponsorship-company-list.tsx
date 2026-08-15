"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
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
          className="font-medium text-primary hover:underline"
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
      render: (c) =>
        c.employeeCount > 0 ? (
          <Link
            href={`/employees?sponsor=${c.id}`}
            className="text-[var(--brand-primary)] hover:underline"
          >
            {c.employeeCount}
          </Link>
        ) : (
          0
        ),
      csvValue: (c) => c.employeeCount,
    },
  ];

  return (
    <DataTable
      rows={sponsorshipCompanies}
      columns={columns}
      // The table already supported a filter; this list just never enabled it,
      // so it was the one partner list you couldn't search.
      searchable
      searchPlaceholder="Search name, short name or licence…"
      rowHref={(c) => `/sponsorship-companies/${c.id}`}
      csvFilename={`sponsorship-companies-${new Date().toISOString().slice(0, 10)}.csv`}
      renderRowActions={(c) => (
        <div className="flex items-center justify-end gap-3">
        <Link
          href={`/sponsorship-companies/${c.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
        <DeleteButton
          action={deleteSponsorshipCompanyAction}
          hiddenFields={{ sponsorshipCompanyId: c.id }}
          confirmMessage={`Delete sponsorship company "${c.name}"?${
            c.employeeCount > 0
              ? ` It is still linked to ${c.employeeCount} employee(s).`
              : ""
          }`}
        />
        </div>
      )}
    />
  );
}
