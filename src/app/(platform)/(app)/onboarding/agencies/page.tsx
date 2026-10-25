import Link from "next/link";
import { ArrowLeft, Download, Handshake } from "lucide-react";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/Badge";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { agencySpend, loadAgencies } from "@/lib/agencySheet";
import { agencyStats } from "@/lib/agencyStats";
import { AddExistingAgency } from "./add-existing";
import { NewAgency } from "./new-agency";

export const metadata = { title: "Recruitment agencies" };

const num = "tabular px-3 py-3 text-right";

export default async function AgenciesPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const canExport = can(subject, "onboarding.tracker", "export");
  const showCosts = can(subject, "finance", "view"); // amounts of money: only for people with Finance access
  const [agencies, others] = await Promise.all([
    loadAgencies(branchId),
    prisma.supplier.findMany({ where: { ...branchWhere(branchId), isOwnCompany: false, isRecruitmentAgency: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const rows = agencies.map((a) => { const s = agencyStats(a.candidateOnboardings); return { a, s, spend: agencySpend(a, s.joined) }; });

  return (
    <div className="space-y-5">
      <Link href="/onboarding" className="inline-flex items-center gap-1 text-sm text-muted hover:underline"><ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Candidate onboarding</Link>
      <PageHeader
        title="Recruitment agencies"
        icon={Handshake}
        meta={<CountPill>{agencies.length}</CountPill>}
        description="The agencies that put candidates forward: how many they sent, how many joined, and where the rest are stuck."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canExport && agencies.length > 0 && <a href="/api/onboarding/agencies/export" className="btn btn-secondary btn-sm"><Download className="h-3.5 w-3.5" aria-hidden /> Master sheet (Excel)</a>}
            <NewAgency />
          </div>
        }
      />
      <AddExistingAgency suppliers={others} />
      {rows.length === 0 ? (
        <EmptyState icon={Handshake} title="No recruitment agencies yet" description="Add the agencies you receive candidates from. Only these are offered when you add a candidate." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Agency</th>
                <th className="px-3 py-3 text-right">Sent</th>
                <th className="px-3 py-3 text-right">In progress</th>
                <th className="px-3 py-3 text-right">Overdue</th>
                <th className="px-3 py-3 text-right">Ready</th>
                <th className="px-3 py-3 text-right">Joined</th>
                <th className="px-3 py-3 text-right">Dropped</th>
                <th className="px-3 py-3 text-right" title="Joined, of those who joined or were dropped">Success</th>
                <th className="px-3 py-3 text-right" title="From being added to joining">Avg days</th>
                {showCosts && <th className="px-3 py-3 text-right" title="Everything recorded against this agency's candidates, dropped ones included">Spent</th>}
                {showCosts && <th className="px-3 py-3 text-right" title="Spent, divided by those who joined">Per hire</th>}
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map(({ a, s, spend }) => (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-primary">{a.name} {a.status !== "ACTIVE" && <Badge color="red">Blacklisted</Badge>}</p>
                    <p className="text-xs text-muted">{[a.country, a.tradeLicenseNumber && `Licence ${a.tradeLicenseNumber}`, a.agencyContacts.length > 0 && `${a.agencyContacts.length} contact${a.agencyContacts.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ") || "No details yet"}</p>
                  </td>
                  <td className={num}>{s.submitted}</td>
                  <td className={num}>{s.inProgress}</td>
                  <td className={`${num} ${s.overdue > 0 ? "font-medium text-[var(--error)]" : ""}`}>{s.overdue}</td>
                  <td className={num}>{s.ready}</td>
                  <td className={num}>{s.joined}</td>
                  <td className={num}>{s.dropped}</td>
                  <td className={num}>{s.successRate === null ? "—" : `${s.successRate}%`}</td>
                  <td className={num}>{s.avgDaysToJoin ?? "—"}</td>
                  {showCosts && <td className={num} title={spend.outstanding > 0 ? `${spend.outstanding.toLocaleString("en-US")} still owing` : undefined}>{spend.total > 0 ? spend.total.toLocaleString("en-US") : "—"}</td>}
                  {showCosts && <td className={num}>{spend.perJoined === null ? "—" : spend.perJoined.toLocaleString("en-US")}</td>}
                  <td className="px-3 py-3 text-right">
                    {canExport && <a href={`/api/onboarding/agencies/${a.id}/export`} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Sheet</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
