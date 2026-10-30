import { redirect } from "next/navigation";
import { Building2, Clock, FileWarning, UsersRound } from "lucide-react";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatTile } from "@/components/StatTile";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { canMyCompanies } from "@/lib/permissions";
import Link from "next/link";
import { Plus } from "lucide-react";
import { loadPeopleRegister } from "@/lib/peopleRegister";
import { hasFlag, type PersonFlag } from "@/lib/peopleFlags";
import { Download } from "lucide-react";
import { ExportLink } from "@/components/ExportLink";
import { PeopleList } from "./people-list";

export const metadata = { title: "Owners & sponsors" };

export default async function PeopleRegisterPage() {
  const { user, branchId } = await requireUserWithBranch();
  if (!canMyCompanies(subjectOf(user))) redirect("/no-access");
  const canEdit = canMyCompanies(subjectOf(user), "edit");

  const rows = await loadPeopleRegister(branchId);

  const count = (f: PersonFlag) => rows.filter((r) => hasFlag(r, f)).length;
  const withGaps = rows.filter((r) => !hasFlag(r, "ok")).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Owners & sponsors"
        icon={UsersRound}
        meta={<CountPill>{rows.length}</CountPill>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {rows.length > 0 && (
              <ExportLink className="btn btn-secondary btn-sm" href="/api/my-companies/people/export" title="An Excel file with one row per person, and a second sheet with one row per company link.">
                <Download className="h-3.5 w-3.5" aria-hidden /> Export
              </ExportLink>
            )}
            {canEdit && <Link href="/my-companies/people/new" className="btn btn-primary btn-sm"><Plus className="h-3.5 w-3.5" aria-hidden /> Add owner or sponsor</Link>}
          </div>
        }
        description="Everyone who owns, sponsors, partners or manages one of your companies, once each, with how many companies they are linked to and whether their documents are on file and in date."
      />
      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="People" value={rows.length} icon={UsersRound} hint={`${rows.filter((r) => r.companyCount > 1).length} serve more than one company`} />
          <StatTile label="Companies linked" value={new Set(rows.flatMap((r) => r.companies.map((c) => c.id))).size} icon={Building2} hint="with at least one owner or sponsor" />
          <StatTile label="Need attention" value={withGaps} icon={FileWarning} tone={withGaps > 0 ? "warning" : "default"} hint={`${count("none")} with no documents · ${count("noexpiry")} with no expiry`} />
          <StatTile label="Expired or expiring" value={rows.filter((r) => r.flags.expired + r.flags.expiring > 0).length} icon={Clock} tone={rows.filter((r) => r.flags.expired + r.flags.expiring > 0).length > 0 ? "warning" : "default"} hint={`${count("expired")} expired · ${count("expiring")} expiring soon`} />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={UsersRound} title="No owners or sponsors yet" description="Add the people who own or sponsor your companies here once, then pick them when you add a company." />
      ) : (
        <PeopleList rows={rows} canEdit={canEdit} />
      )}
    </div>
  );
}
