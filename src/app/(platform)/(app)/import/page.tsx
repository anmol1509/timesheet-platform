import Link from "next/link";
import { redirect } from "next/navigation";
import { FileStack, Briefcase, Building2, Landmark, Bus, CalendarClock, HardHat, Home, Truck, ShieldCheck, Zap, Database, ArrowRight, UploadCloud, type LucideIcon } from "lucide-react";
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

export const metadata = { title: "Import data" };

type Tone = "brand" | "info" | "success" | "warning" | "error";
const TONE: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  info: "bg-info-soft text-[var(--info)]",
  success: "bg-success-soft text-[var(--success)]",
  warning: "bg-warning-soft text-[var(--warning)]",
  error: "bg-error-soft text-[var(--error)]",
};

/** One tile per thing you can bring in. `kind` is the importer; Documents has its own flow. */
const TILES: { kind: ImportKind | "DOCUMENTS" | "C3"; icon: LucideIcon; tone: Tone; label: string; short: string; href: string }[] = [
  { kind: "TIMESHEETS", icon: CalendarClock, tone: "error", label: "Timesheets", short: "Monthly workbook. Reads suppliers, clients, workers and hours.", href: "/import/new/timesheets" },
  { kind: "WORKERS", icon: HardHat, tone: "warning", label: "Workers", short: "Codes, trades, passport, Emirates ID, visa and labour card dates.", href: "/import/new/workers" },
  { kind: "SUPPLIERS", icon: Truck, tone: "success", label: "Suppliers", short: "Manpower suppliers and sub-suppliers, with contacts.", href: "/import/new/suppliers" },
  { kind: "COMPANIES", icon: Landmark, tone: "brand", label: "My Companies", short: "Your own companies: licence, permit, owners with shares and sponsors.", href: "/import/new/companies" },
  { kind: "CLIENTS", icon: Building2, tone: "info", label: "Clients", short: "Companies you supply workers to, with billing details.", href: "/import/new/clients" },
  { kind: "CAMPS", icon: Home, tone: "success", label: "Camps", short: "Camps with their rooms and beds. Beds are optional.", href: "/import/new/camps" },
  { kind: "VEHICLES", icon: Bus, tone: "info", label: "Vehicles", short: "Vehicles and drivers, with Mulkiya and insurance dates.", href: "/import/new/vehicles" },
  { kind: "MOBILISATION", icon: Briefcase, tone: "warning", label: "Mobilisation", short: "Where each worker is deployed today: client, project, stage.", href: "/import/new/mobilisation" },
  { kind: "C3", icon: Zap, tone: "info", label: "C3 IDs", short: "Upload a sheet of worker names and C3 IDs and link them to existing workers.", href: "/import/new/c3" },
  { kind: "DOCUMENTS", icon: FileStack, tone: "brand", label: "Documents", short: "Passports, IDs and visas in bulk. Drop files or a ZIP.", href: "/import/new/documents" },
];

const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  DRAFT: { label: "Not finished", color: "slate" },
  PREVIEWED: { label: "Not finished", color: "slate" },
  RUNNING: { label: "Importing", color: "blue" },
  DONE: { label: "Done", color: "green" },
  FAILED: { label: "Stopped", color: "red" },
  UNDONE: { label: "Undone", color: "amber" },
};

export default async function ImportHubPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
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
  const [nWorkers, nSuppliers, nClients, nCamps, nVehicles, nOwn] = await Promise.all([
    prisma.employee.count({ where: bw }),
    prisma.supplier.count({ where: bw }),
    prisma.client.count({ where: bw }),
    prisma.camp.count({ where: bw }),
    prisma.vehicle.count({ where: bw }),
    prisma.supplier.count({ where: { ...bw, isOwnCompany: true } }),
  ]);
  const held: Partial<Record<ImportKind, number>> = { WORKERS: nWorkers, SUPPLIERS: nSuppliers, COMPANIES: nOwn, CLIENTS: nClients, CAMPS: nCamps, VEHICLES: nVehicles };
  const lastOf = (kind: string) => batches.find((b) => b.kind === kind && (b.status === "DONE" || b.status === "UNDONE"));

  return (
    <div className="space-y-8">
      <HeroHeader
        icon={UploadCloud}
        eyebrow="Data import"
        title="Import data"
        subtitle="Bring in what you already have. Nothing is saved until you've seen what will happen."
        aside={
          <div className="relative mr-4 h-28 w-40">
            <span className="absolute right-6 top-1 flex h-24 w-20 items-center justify-center rounded-2xl bg-white/90 shadow-lg"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5b49d8] text-white"><UploadCloud className="h-5 w-5" /></span></span>
            <span className="absolute left-2 top-4 -rotate-6 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-[#1d7a45] shadow-md">XLS</span>
            <span className="absolute right-0 bottom-2 rotate-6 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-[#2a5bd7] shadow-md">CSV</span>
          </div>
        }
      >
        <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-white/90">
          <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden />Safe &amp; secure</li>
          <li className="flex items-center gap-2"><Zap className="h-4 w-4" aria-hidden />Preview before import</li>
          <li className="flex items-center gap-2"><Database className="h-4 w-4" aria-hidden />Every import can be undone</li>
        </ul>
      </HeroHeader>
      {isSuperAdmin && !branchId && (
        <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-sm text-[var(--warning)]">
          You&apos;re viewing <strong>All companies</strong>. Sign in as a company administrator before importing.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TILES.map((t) => {
          const n = t.kind === "DOCUMENTS" || t.kind === "C3" ? undefined : held[t.kind];
          const last = lastOf(t.kind);
          return (
            <Link key={t.kind} href={t.href} className="card group flex flex-col gap-3 p-5 transition hover:border-[var(--brand-primary-border)] hover:shadow-md">
              <div className="flex items-start justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${TONE[t.tone]}`}><t.icon className="h-5 w-5" aria-hidden /></span>
                <ArrowRight className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
              </div>
              <div>
                <p className="text-base font-semibold text-primary">{t.label}</p>
                <p className="mt-1 min-h-[2.5rem] text-xs text-secondary">{t.short}</p>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2">
                <span className="rounded-lg bg-surface-subtle px-2.5 py-1.5 text-xs text-muted" title={last ? `Last imported ${last.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : undefined}>
                  {n === undefined ? (t.kind === "DOCUMENTS" ? "PDF, images, ZIP" : "Excel or CSV") : n === 0 ? "No records" : <><span className="tabular font-medium text-primary">{n}</span> on record</>}
                </span>
                <span className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold ${n === 0 ? "bg-[var(--brand-primary)] text-white" : "bg-brand-soft text-brand"}`}>Import <ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>
              </div>
            </Link>
          );
        })}
      </div>

      {branchId && <GetStarted branchId={branchId} />}

      {branchId && <SampleCard loaded={sample.loaded} />}

      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-primary">Recent imports</h2>
            <p className="text-xs text-muted">{all ? "Your last 25 import activities" : "Your last 5 import activities"}</p>
          </div>
          {batches.length > 5 && <Link href={all ? "/import" : "/import?all=1"} scroll={false} className="btn btn-secondary btn-sm">{all ? "Show fewer" : "View all"}</Link>}
        </div>
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
                {(all ? batches : batches.slice(0, 5)).map((b) => {
                  const counts = (b.summary ? (JSON.parse(b.summary) as { counts?: Record<string, number> }).counts : null) ?? {};
                  const st = STATUS[b.status] ?? STATUS.DRAFT;
                  const canUndo = (b.status === "DONE" || b.status === "FAILED") && b.undoUntil && b.undoUntil > new Date();
                  return (
                    <tr key={b.id}>
                      <td className="px-4 py-3 font-medium text-primary">
                        {(() => {
                          const tile = TILES.find((t) => t.kind === b.kind);
                          return (
                            <span className="flex items-center gap-2.5">
                              {tile && <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${TONE[tile.tone]}`}><tile.icon className="h-3.5 w-3.5" aria-hidden /></span>}
                              {b.kind === "DOCUMENTS" ? "Documents" : (TARGETS[b.kind as ImportKind]?.label ?? b.kind)}
                            </span>
                          );
                        })()}
                      </td>
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
