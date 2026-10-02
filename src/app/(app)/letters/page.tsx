import { FileSignature, Hash, CalendarDays, FileStack } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { askLabels, templateHtml, tokensIn } from "@/lib/letterHtml";
import { formatLetterDate } from "@/lib/letterLayout";
import { SALARY_KEYS, refLabel } from "@/lib/employeeLetter";
import { IssueLetter } from "./issue-letter";

export const metadata = { title: "Employee letters" };

export default async function EmployeeLettersPage({ searchParams }: { searchParams: Promise<{ employee?: string; template?: string }> }) {
  const sp = await searchParams;
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [templates, employees, issued, nocs, branch, totalIssued, issuedThisMonth, byTitle] = await Promise.all([
    prisma.letterTemplate.findMany({ where: { ...branchWhere(branchId), audience: "EMPLOYEE" }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { ...branchWhere(branchId), status: { not: "TERMINATED" }, supplier: { isOwnCompany: true } }, orderBy: { name: "asc" }, take: 2000, select: { id: true, name: true, employeeIdNo: true, trade: true } }),
    prisma.issuedLetter.findMany({ where: branchWhere(branchId), orderBy: { createdAt: "desc" }, take: 50, include: { employee: { select: { name: true, employeeIdNo: true } }, issuedBy: { select: { name: true } } } }),
    prisma.noc.findMany({ where: branchWhere(branchId), orderBy: { createdAt: "desc" }, take: 50, include: { template: { select: { title: true, name: true } }, demandRequest: { select: { requestNo: true, client: { select: { name: true } }, project: { select: { name: true } } } }, requestedBy: { select: { name: true } }, _count: { select: { employees: true } } } }),
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, signatoryName: true, signatoryTitle: true, signatureId: true, stampId: true, letterheadImageId: true, letterheadTopMm: true, letterheadBottomMm: true } }) : null,
    prisma.issuedLetter.count({ where: branchWhere(branchId) }),
    prisma.issuedLetter.count({ where: { ...branchWhere(branchId), createdAt: { gte: monthStart } } }),
    prisma.issuedLetter.groupBy({ by: ["title"], where: branchWhere(branchId), _count: { _all: true }, orderBy: { _count: { title: "desc" } }, take: 1 }),
  ]);
  // Employee letters and NOCs in one list, newest first.
  const history = [
    ...issued.map((l) => ({ key: `l-${l.id}`, kind: "Letter" as const, ref: refLabel(l.refNo), who: l.employee.name, whoSub: l.employee.employeeIdNo, title: l.title, at: l.createdAt, by: l.issuedBy.name, href: `/api/letters/${l.id}/pdf` })),
    ...nocs.map((n) => ({ key: `n-${n.id}`, kind: "NOC" as const, ref: `NOC-${n.docNo}`, who: n.demandRequest.client.name, whoSub: `${n.demandRequest.project.name} · ${n._count.employees} worker${n._count.employees === 1 ? "" : "s"}`, title: n.template.title || n.template.name, at: n.createdAt, by: n.requestedBy?.name ?? "—", href: `/api/nocs/${n.id}?letterhead=1` })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 60);
  const mostRequested = byTitle[0]?.title ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Letters"
        icon={FileSignature}
        description={<>Employee letters (salary certificates, experience letters, warnings and more) made from your templates, for the employees of your own company. NOCs for clients are made from a demand's documents and listed here too. Edit the wording under Administration → Letter Templates.</>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Letters issued" value={totalIssued} icon={FileStack} hint="all time" />
        <StatTile label="Issued this month" value={issuedThisMonth} icon={CalendarDays} hint="since the 1st" />
        <StatTile label="Templates available" value={templates.length} icon={Hash} />
        <StatTile label="Most requested" value={mostRequested} icon={FileSignature} />
      </div>

      {!branchId ? (
        <p className="text-sm text-muted">Pick a branch from the switcher to make letters.</p>
      ) : (
        <IssueLetter
          initialEmployeeId={sp.employee}
          preferTemplate={sp.template}
          canIssue={can(subject, "workforce", "create")}
          companyName={(branch?.name ?? "").toUpperCase()}
          today={formatLetterDate(new Date())}
          defaults={{
            signatoryName: branch?.signatoryName ?? "",
            signatoryTitle: branch?.signatoryTitle ?? "",
            signatureUrl: branch?.signatureId ? `/api/images/${branch.signatureId}` : null,
            stampUrl: branch?.stampId ? `/api/images/${branch.stampId}` : null,
            letterheadUrl: branch?.letterheadImageId ? `/api/images/${branch.letterheadImageId}` : null,
            topMm: branch?.letterheadTopMm ?? 65,
            bottomMm: branch?.letterheadBottomMm ?? 35,
          }}
          employees={employees.map((e) => ({ id: e.id, name: e.name, idNo: e.employeeIdNo, trade: e.trade }))}
          templates={templates.map((t) => {
            const html = templateHtml(t);
            return { id: t.id, name: t.name, asks: askLabels(html), usesSalary: tokensIn(html).some((k) => SALARY_KEYS.includes(k)) };
          })}
        />
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-primary">Recently issued</h2>
        {history.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">Nothing issued yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-3">Ref</th><th className="px-4 py-3">For</th><th className="px-4 py-3">Letter</th><th className="px-4 py-3">Issued</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {history.map((h) => (
                  <tr key={h.key}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-primary">{h.ref}</td>
                    <td className="px-4 py-3"><p className="text-primary">{h.who}</p><p className="text-xs text-muted">{h.whoSub}</p></td>
                    <td className="px-4 py-3 text-secondary"><span className={`mr-2 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${h.kind === "NOC" ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-surface-sunken text-secondary"}`}>{h.kind}</span>{h.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-secondary">{formatLetterDate(h.at)}<p className="text-xs text-muted">by {h.by}</p></td>
                    <td className="px-4 py-3 text-right"><a href={h.href} target="_blank" rel="noreferrer" className="btn btn-secondary">PDF</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
