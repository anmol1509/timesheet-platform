import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { askLabels, templateHtml, tokensIn } from "@/lib/letterHtml";
import { formatLetterDate } from "@/lib/letterLayout";
import { SALARY_KEYS, refLabel } from "@/lib/employeeLetter";
import { IssueLetter } from "./issue-letter";

export const metadata = { title: "Employee letters" };

export default async function EmployeeLettersPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const [templates, employees, issued, branch] = await Promise.all([
    prisma.letterTemplate.findMany({ where: { ...branchWhere(branchId), audience: "EMPLOYEE" }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { ...branchWhere(branchId), status: { not: "TERMINATED" } }, orderBy: { name: "asc" }, take: 2000, select: { id: true, name: true, employeeIdNo: true, trade: true } }),
    prisma.issuedLetter.findMany({ where: branchWhere(branchId), orderBy: { createdAt: "desc" }, take: 50, include: { employee: { select: { name: true, employeeIdNo: true } }, issuedBy: { select: { name: true } } } }),
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, signatoryName: true, signatoryTitle: true, signatureId: true, stampId: true, letterheadImageId: true } }) : null,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Employee letters</h1>
        <p className="mt-1 text-sm text-muted">Salary certificates, experience letters, warnings and more, made from your templates with the employee&apos;s details filled in. Edit the wording under Administration → Letter Templates.</p>
      </div>

      {!branchId ? (
        <p className="text-sm text-muted">Pick a branch from the switcher to make letters.</p>
      ) : (
        <IssueLetter
          canIssue={can(subject, "workforce", "create")}
          companyName={(branch?.name ?? "").toUpperCase()}
          today={formatLetterDate(new Date())}
          defaults={{
            signatoryName: branch?.signatoryName ?? "",
            signatoryTitle: branch?.signatoryTitle ?? "",
            signatureUrl: branch?.signatureId ? `/api/images/${branch.signatureId}` : null,
            stampUrl: branch?.stampId ? `/api/images/${branch.stampId}` : null,
            letterheadUrl: branch?.letterheadImageId ? `/api/images/${branch.letterheadImageId}` : null,
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
        {issued.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">Nothing issued yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-3">Ref</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Letter</th><th className="px-4 py-3">Issued</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {issued.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-primary">{refLabel(l.refNo)}</td>
                    <td className="px-4 py-3"><p className="text-primary">{l.employee.name}</p><p className="text-xs text-muted">{l.employee.employeeIdNo}</p></td>
                    <td className="px-4 py-3 text-secondary">{l.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-secondary">{formatLetterDate(l.createdAt)}<p className="text-xs text-muted">by {l.issuedBy.name}</p></td>
                    <td className="px-4 py-3 text-right"><a href={`/api/letters/${l.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-secondary">PDF</a></td>
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
