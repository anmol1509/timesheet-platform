import Link from "next/link";
import { redirect } from "next/navigation";
import { FileStack, Briefcase, Building2, Bus, CalendarClock, HardHat, Home, Truck, type LucideIcon } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { Badge, type BadgeColor } from "@/components/Badge";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { TARGETS } from "@/lib/importer/targets";
import type { ImportKind } from "@/lib/importer/types";
import { UndoImportButton } from "./undo-button";
import { GetStarted } from "@/components/GetStarted";
import { sampleState } from "@/lib/importer/sample";
import { SampleCard } from "./sample-card";

const CARDS: { kind: ImportKind; icon: LucideIcon; blurb: string; hint: string }[] = [
  { kind: "TIMESHEETS", icon: CalendarClock, blurb: "Your monthly timesheet workbook. Suppliers, sponsors, clients, workers, hours and attendance are all read from it.", hint: "Best place to start if a spreadsheet is what you use today" },
  { kind: "SUPPLIERS", icon: Truck, blurb: "Manpower suppliers and sub-suppliers, with codes, contacts and trade licence details.", hint: "Excel or CSV" },
  { kind: "CLIENTS", icon: Building2, blurb: "The companies you supply workers to, with contacts and billing details.", hint: "Excel or CSV" },
  { kind: "CAMPS", icon: Home, blurb: "Camps with their rooms and beds. Each camp is Own, Supplier or Client. Beds are optional.", hint: "Excel or CSV" },
  { kind: "VEHICLES", icon: Bus, blurb: "Your vehicles and drivers, with seats, Mulkiya and insurance expiry dates.", hint: "Excel or CSV" },
  { kind: "MOBILISATION", icon: Briefcase, blurb: "Where each worker is deployed today: client, project, stage and dates. Clients and projects not on record can be added in one click.", hint: "For moving over your current deployments" },
  { kind: "WORKERS", icon: HardHat, blurb: "Your worker list: codes, trades, nationality, passport, Emirates ID, visa and labour card dates.", hint: "Excel or CSV" },
];

const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  DRAFT: { label: "Not finished", color: "slate" },
  PREVIEWED: { label: "Not finished", color: "slate" },
  RUNNING: { label: "Importing", color: "blue" },
  DONE: { label: "Done", color: "green" },
  FAILED: { label: "Stopped", color: "red" },
  UNDONE: { label: "Undone", color: "amber" },
};

export default async function ImportHubPage() {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!isAdminRole(user.role)) redirect("/no-access");

  const batches = branchId
    ? await prisma.importBatch.findMany({
        where: { branchId, status: { not: "DRAFT" } },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: { id: true, kind: true, filename: true, status: true, createdAt: true, summary: true, undoUntil: true, createdBy: { select: { name: true } } },
      })
    : [];

  const sample = branchId ? await sampleState(branchId) : { loaded: false };
  const bw = branchId ? { branchId } : {};
  const [nWorkers, nSuppliers, nClients, nCamps, nVehicles] = await Promise.all([
    prisma.employee.count({ where: bw }),
    prisma.supplier.count({ where: bw }),
    prisma.client.count({ where: bw }),
    prisma.camp.count({ where: bw }),
    prisma.vehicle.count({ where: bw }),
  ]);
  const held: Partial<Record<ImportKind, number>> = { WORKERS: nWorkers, SUPPLIERS: nSuppliers, CLIENTS: nClients, CAMPS: nCamps, VEHICLES: nVehicles };
  const lastOf = (kind: string) => batches.find((b) => b.kind === kind && (b.status === "DONE" || b.status === "UNDONE"));
  const lastImport = batches.find((b) => b.status === "DONE");

  return (
    <div className="space-y-8">
      <HeroHeader
        icon={FileStack}
        title="Import data"
        subtitle="Bring in what you already have. Nothing is saved until you've seen what will happen, and every import can be undone."
        pills={[
          { label: "Workers", value: String(nWorkers) },
          { label: "Suppliers", value: String(nSuppliers) },
          { label: "Clients", value: String(nClients) },
          { label: "Last import", value: lastImport ? lastImport.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "None yet" },
          ...(batches.some((b) => b.status === "FAILED") ? [{ label: "Stopped", value: String(batches.filter((b) => b.status === "FAILED").length), warn: true }] : []),
        ]}
      />
      {isSuperAdmin && !branchId && (
        <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-sm text-[var(--warning)]">
          You&apos;re viewing <strong>All branches</strong>. Pick a specific branch from the switcher (top right) before importing.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link key={c.kind} href={`/import/new/${c.kind.toLowerCase()}`} className="card group flex flex-col gap-3 p-5 transition hover:border-[var(--brand-primary-border)] hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-[var(--brand-primary)]">
                <c.icon className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-base font-semibold text-primary">{TARGETS[c.kind].label}</p>
            </div>
            <p className="text-sm text-secondary">{c.blurb}</p>
            <p className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>
                {held[c.kind] !== undefined && <><span className="tabular font-medium text-primary">{held[c.kind]}</span> on record{lastOf(c.kind) ? ` · last imported ${lastOf(c.kind)!.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</>}
                {held[c.kind] === undefined && c.hint}
              </span>
              <span className="font-medium text-[var(--brand-primary)] group-hover:underline">Start import →</span>
            </p>
          </Link>
        ))}
      </div>

      <Link href="/import/new/documents" className="card group flex items-center gap-4 p-5 transition hover:border-[var(--brand-primary-border)] hover:shadow-md">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-[var(--brand-primary)]"><FileStack className="h-5 w-5" aria-hidden /></span>
        <div>
          <p className="text-base font-semibold text-primary">Documents</p>
          <p className="text-sm text-secondary">Passports, Emirates IDs, visas, licences and more in bulk. Drop many files or a ZIP and each is filed against the right worker or supplier.</p>
          <p className="mt-1 text-xs text-muted">PDF or images &middot; <span className="font-medium text-[var(--brand-primary)] group-hover:underline">Start</span></p>
        </div>
      </Link>

      {branchId && <GetStarted branchId={branchId} />}

      {branchId && <SampleCard loaded={sample.loaded} />}

      <section>
        <h2 className="text-sm font-semibold text-primary">Recent imports</h2>
        {batches.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-default px-4 py-8 text-center text-sm text-muted">No imports yet. Pick one above to get started.</p>
        ) : (
          <div className="card mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">What</th>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {batches.map((b) => {
                  const counts = (b.summary ? (JSON.parse(b.summary) as { counts?: Record<string, number> }).counts : null) ?? {};
                  const st = STATUS[b.status] ?? STATUS.DRAFT;
                  const canUndo = (b.status === "DONE" || b.status === "FAILED") && b.undoUntil && b.undoUntil > new Date();
                  return (
                    <tr key={b.id}>
                      <td className="px-4 py-3 font-medium text-primary">{b.kind === "DOCUMENTS" ? "Documents" : (TARGETS[b.kind as ImportKind]?.label ?? b.kind)}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-secondary" title={b.filename}>{b.filename}</td>
                      <td className="px-4 py-3 text-muted">
                        <div className="tabular">{b.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                        <div className="text-xs">{b.createdBy.name}</div>
                      </td>
                      <td className="tabular px-4 py-3 text-secondary">
                        {b.status === "DONE" || b.status === "UNDONE" ? `${counts.created ?? 0} new · ${counts.updated ?? 0} updated${counts.failed ? ` · ${counts.failed} failed` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3"><Badge dot color={st.color}>{st.label}</Badge></td>
                      <td className="px-4 py-3 text-right">{canUndo ? <UndoImportButton batchId={b.id} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
