import { MARGIN_BRANCH_SELECT, marginsOfBranch } from "@/lib/paperMargins";
import Link from "next/link";
import { FileSignature } from "lucide-react";
import { HeroHeader, heroButton } from "@/components/HeroHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { isAdminRole } from "@/lib/roles";
import { askLabels, templateHtml, tokensIn } from "@/lib/letterHtml";
import { formatLetterDate } from "@/lib/letterLayout";
import { SALARY_KEYS, refLabel } from "@/lib/employeeLetter";
import { IssueLetter } from "./issue-letter";
import { IssuedList, type IssuedRow } from "./issued-list";
import { AddDefaultsButton } from "../letter-templates/gallery";
import { LETTER_PRESETS } from "@/lib/letterPresets";

export const metadata = { title: "Employee letters" };

export default async function EmployeeLettersPage({ searchParams }: { searchParams: Promise<{ employee?: string; template?: string }> }) {
  const sp = await searchParams;
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [templates, employees, issued, nocs, checkIns, branch, totalIssued, issuedThisMonth, byTitle, byTemplate] = await Promise.all([
    prisma.letterTemplate.findMany({ where: { ...branchWhere(branchId), audience: "EMPLOYEE" }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.employee.findMany({ where: { ...branchWhere(branchId), status: { not: "TERMINATED" }, supplier: { isOwnCompany: true } }, orderBy: { name: "asc" }, take: 2000, select: { id: true, name: true, employeeIdNo: true, trade: true } }),
    prisma.issuedLetter.findMany({ where: branchWhere(branchId), orderBy: { createdAt: "desc" }, take: 50, include: { employee: { select: { name: true, employeeIdNo: true } }, issuedBy: { select: { name: true } } } }),
    prisma.noc.findMany({ where: branchWhere(branchId), orderBy: { createdAt: "desc" }, take: 50, include: { template: { select: { title: true, name: true } }, demandRequest: { select: { requestNo: true, client: { select: { name: true } }, project: { select: { name: true } } } }, requestedBy: { select: { name: true } }, _count: { select: { employees: true } } } }),
    prisma.campCheckIn.findMany({ where: { employee: branchWhere(branchId) }, orderBy: { checkInNo: "desc" }, take: 600, select: { id: true, checkInNo: true, checkInDate: true, createdAt: true, campId: true, camp: { select: { name: true } } } }),
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, signatoryName: true, signatoryTitle: true, signatureId: true, stampId: true, letterheadImageId: true, letterheadTopMm: true, letterheadBottomMm: true, ...MARGIN_BRANCH_SELECT } }) : null,
    prisma.issuedLetter.count({ where: branchWhere(branchId) }),
    prisma.issuedLetter.count({ where: { ...branchWhere(branchId), createdAt: { gte: monthStart } } }),
    prisma.issuedLetter.groupBy({ by: ["title"], where: branchWhere(branchId), _count: { _all: true }, orderBy: { _count: { title: "desc" } }, take: 1 }),
    prisma.issuedLetter.groupBy({ by: ["templateId"], where: { ...branchWhere(branchId), templateId: { not: null } }, _count: { _all: true } }),
  ]);
  // Check-in documents: the workers checked in to one camp on one day are one document, so they download together again.
  const batches = new Map<string, { ids: string[]; nos: number[]; camp: string; day: Date; at: Date }>();
  for (const c of checkIns) {
    const key = `${c.campId}|${c.checkInDate.toISOString().slice(0, 10)}`;
    const b = batches.get(key) ?? { ids: [], nos: [], camp: c.camp.name, day: c.checkInDate, at: c.createdAt };
    b.ids.push(c.id); b.nos.push(c.checkInNo);
    if (c.createdAt > b.at) b.at = c.createdAt;
    batches.set(key, b);
  }
  // Employee letters, NOCs and check-in documents in one list, newest first.
  const history: IssuedRow[] = [
    ...issued.map((l) => ({ key: `l-${l.id}`, kind: "Letter" as const, ref: refLabel(l.refNo), who: l.employee.name, whoSub: l.employee.employeeIdNo, title: l.title, at: l.createdAt, by: l.issuedBy.name, href: `/api/letters/${l.id}/pdf`, edited: !!(l.layout as { edited?: boolean } | null)?.edited })),
    ...nocs.map((n) => ({ key: `n-${n.id}`, kind: "NOC" as const, ref: `NOC-${n.docNo}`, who: n.demandRequest.client.name, whoSub: `${n.demandRequest.project.name} · ${n._count.employees} worker${n._count.employees === 1 ? "" : "s"}`, title: n.template.title || n.template.name, at: n.createdAt, by: n.requestedBy?.name ?? "—", href: `/api/nocs/${n.id}?letterhead=1` })),
    ...[...batches.entries()].map(([key, b]) => ({ key: `c-${key}`, kind: "Check-in" as const, ref: `CHK-${String(Math.min(...b.nos)).padStart(5, "0")}${b.nos.length > 1 ? `–${String(Math.max(...b.nos)).padStart(5, "0")}` : ""}`, who: b.camp, whoSub: `${b.ids.length} worker${b.ids.length === 1 ? "" : "s"} · checked in ${b.day.toISOString().slice(0, 10)}`, title: "Check-in list", at: b.at, by: "—", href: `/api/checkins/pdf?ids=${b.ids.join(",")}` })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 60).map((h) => ({ ...h, at: formatLetterDate(h.at) }));
  const mostRequested = byTitle[0]?.title ?? "—";
  // The letters used most come first as shortcuts; unused templates fill the row up to four.
  const usage = new Map(byTemplate.map((u) => [u.templateId, u._count._all]));
  const COMMON = ["salary certificate", "experience certificate", "employment certificate", "warning letter"];
  const rank = (name: string) => { const i = COMMON.indexOf(name.toLowerCase()); return i < 0 ? COMMON.length : i; };
  const popular = [...templates].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)).slice(0, 4).map((t) => ({ id: t.id, name: t.name, count: usage.get(t.id) ?? 0 }));
  const employeePresets = LETTER_PRESETS.filter((p) => p.audience === "EMPLOYEE");

  return (
    <div className="space-y-6">
      <HeroHeader
        icon={FileSignature}
        title="Letters"
        subtitle="Salary certificates, experience letters, warnings and more, on your letterhead."
        pills={[
          { label: "Issued this month", value: String(issuedThisMonth) },
          { label: "All time", value: String(totalIssued) },
          { label: "Templates", value: String(templates.length) },
          { label: "Most requested", value: mostRequested },
        ]}
        actions={<Link href="/operations/nocs/new" className={heroButton()}>New NOC</Link>}
      />

      {!branchId ? (
        <p className="text-sm text-muted">Sign in as a company administrator to make letters.</p>
      ) : (
        <IssueLetter
          initialEmployeeId={sp.employee}
          preferTemplate={sp.template}
          canIssue={can(subject, "workforce.letters", "create")}
          branchId={branchId}
          canSaveDefault={{ profile: isAdminRole(user.role), supplier: can(subject, "partners.suppliers", "edit") }}
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
            ...marginsOfBranch(branch),
          }}
          employees={employees.map((e) => ({ id: e.id, name: e.name, idNo: e.employeeIdNo, trade: e.trade }))}
          popular={popular}
          templates={templates.map((t) => {
            const html = templateHtml(t);
            return { id: t.id, name: t.name, asks: askLabels(html), usesSalary: tokensIn(html).some((k) => SALARY_KEYS.includes(k)) };
          })}
        />
      )}

      {branchId && templates.length === 0 && (
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold text-primary">Start with the ready-made set</h2><p className="mt-1 text-sm text-muted">{employeePresets.length} employee letters with the right fields already in place. Change any of them afterwards under Templates.</p></div>
            <AddDefaultsButton primary label={`Add all ${LETTER_PRESETS.length}`} />
          </div>
          <ul className="mt-4 grid gap-1.5 text-sm text-secondary sm:grid-cols-2 lg:grid-cols-3">{employeePresets.map((p) => <li key={p.key}>{p.name}</li>)}</ul>
        </section>
      )}

      <IssuedList rows={history} />
    </div>
  );
}
