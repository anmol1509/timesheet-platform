import Link from "next/link";
import { BedDouble, FileCheck2, HardHat, MapPin, Phone, MessageCircle, Package } from "lucide-react";
import { Badge } from "@/components/Badge";
import { COMPLIANCE_FIELDS, complianceStatus, daysUntil } from "@/lib/compliance";
import { STAGE_COLOR, STAGE_LABEL } from "@/lib/employeeStage";
import { cn } from "@/lib/cn";

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
const digits = (s: string) => s.replace(/[^\d]/g, "");

type Props = {
  employee: Record<string, unknown> & {
    id: string;
    status: string;
    mobileNumber: string | null;
    mobilisationDate: Date | null;
    siteArrivalDate: Date | null;
  };
  project: { id: string; name: string; manager: string | null; managerPhone: string | null; client: { name: string } } | null;
  bed: { label: string; roomName: string; campName: string } | null;
  supplier: { id: string; name: string; contactPerson: string | null; contactPhone: string | null } | null;
  latest: { monthLabel: string; totalHours: number; rate: number; status: string } | null;
  ppeOut: number;
  documentCount: number;
};

function Card({ icon: Icon, title, children, href }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; href?: string }) {
  return (
    <section className="card flex flex-col gap-2 p-4">
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {title}
        </h2>
        {href && <Link href={href} className="text-xs text-[var(--brand-primary)] hover:underline">View</Link>}
      </header>
      {children}
    </section>
  );
}

export function ProfileSummary({ employee: e, project, bed, supplier, latest, ppeOut, documentCount }: Props) {
  const docs = COMPLIANCE_FIELDS.slice(0, 5).map((f) => {
    const value = (e as Record<string, unknown>)[f.key] as Date | null;
    return { label: f.label, value, status: complianceStatus(value), days: value ? daysUntil(value) : null };
  });
  const attention = docs.filter((d) => d.status === "expired" || d.status === "expiring" || d.status === "not_set").length;
  const dot = { valid: "bg-[var(--success)]", expiring: "bg-[var(--warning)]", expired: "bg-[var(--error)]", not_set: "bg-[var(--text-subtle)]" } as const;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card icon={HardHat} title="Deployment">
          <div>
            <Badge color={STAGE_COLOR[e.status] ?? "slate"} dot>{STAGE_LABEL[e.status] ?? e.status}</Badge>
          </div>
          {project ? (
            <div className="text-sm">
              <Link href={`/projects/${project.id}`} className="font-medium text-primary hover:underline">{project.name}</Link>
              <p className="text-xs text-muted">{project.client.name}</p>
              {project.manager && (
                <p className="mt-1 text-xs text-secondary">
                  PM {project.manager}
                  {project.managerPhone && <> · <a className="hover:underline" href={`tel:${project.managerPhone}`}>{project.managerPhone}</a></>}
                </p>
              )}
              {e.status === "UNDER_MOBILISATION" && e.mobilisationDate && <p className="mt-1 text-xs text-[var(--warning)]">Due on site {fmt(e.mobilisationDate)}</p>}
              {e.status === "ON_SITE" && e.siteArrivalDate && <p className="mt-1 text-xs text-muted">On site since {fmt(e.siteArrivalDate)}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted">Not assigned to a project.</p>
          )}
        </Card>

        <Card icon={BedDouble} title="Accommodation" href="/accommodation/camps">
          {bed ? (
            <div className="text-sm">
              <p className="font-medium text-primary">{bed.campName}</p>
              <p className="text-xs text-muted">{bed.roomName} · {bed.label}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Not housed. Allocate a bed from the accommodation section below.</p>
          )}
        </Card>

        <Card icon={FileCheck2} title="Documents">
          <ul className="space-y-1">
            {docs.map((d) => (
              <li key={d.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-secondary"><span className={cn("h-1.5 w-1.5 rounded-full", dot[d.status])} />{d.label}</span>
                <span className={cn("tabular", d.status === "expired" ? "font-medium text-[var(--error)]" : d.status === "expiring" ? "font-medium text-[var(--warning)]" : "text-muted")}>
                  {d.value ? (d.days! < 0 ? `${-d.days!}d overdue` : `${d.days}d`) : "not set"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-subtle">{attention === 0 ? "All valid." : `${attention} need attention.`} {documentCount} file{documentCount === 1 ? "" : "s"} uploaded.</p>
        </Card>

        <Card icon={Package} title="Work & equipment">
          {latest ? (
            <div className="text-sm">
              <p className="tabular font-medium text-primary">{latest.totalHours.toLocaleString()} h <span className="font-normal text-muted">· {latest.monthLabel}</span></p>
              <p className="text-xs text-muted">AED {latest.rate.toFixed(2)}/h · {latest.status.toLowerCase().replace("_", " ")}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">No timesheet on record yet.</p>
          )}
          <p className="text-xs text-secondary">{ppeOut > 0 ? `${ppeOut} item${ppeOut === 1 ? "" : "s"} issued` : "No PPE or tools issued"}</p>
        </Card>
      </div>

      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
        <span className="flex items-center gap-1.5 text-muted"><MapPin className="h-3.5 w-3.5" aria-hidden />Company</span>
        <span className="text-primary">{supplier ? <Link href={`/suppliers/${supplier.id}`} className="hover:underline">{supplier.name}</Link> : "No company"}</span>
        {supplier?.contactPerson && <span className="text-xs text-muted">{supplier.contactPerson}{supplier.contactPhone ? ` · ${supplier.contactPhone}` : ""}</span>}
        <span className="ml-auto flex items-center gap-2">
          {e.mobileNumber ? (
            <>
              <span className="tabular text-secondary">{e.mobileNumber}</span>
              <a href={`tel:${e.mobileNumber}`} className="btn btn-secondary btn-sm gap-1.5"><Phone className="h-3.5 w-3.5" aria-hidden />Call</a>
              <a href={`https://wa.me/${digits(e.mobileNumber)}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm gap-1.5"><MessageCircle className="h-3.5 w-3.5" aria-hidden />WhatsApp</a>
            </>
          ) : (
            <span className="text-xs text-muted">No mobile number on file.</span>
          )}
        </span>
      </div>
    </div>
  );
}
