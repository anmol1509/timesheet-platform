import Link from "next/link";
import { LayoutTemplate, FileSpreadsheet, FileText, Pencil, Copy } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { TemplatePreview } from "@/components/TimesheetTemplatePicker";
import { DeleteButton } from "@/components/DeleteButton";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { isAdminRole } from "@/lib/roles";
import { TIMESHEET_TEMPLATES, templateByKey, isTemplateKey } from "@/lib/timesheetTemplates";
import { customiseTemplateAction, duplicateTimesheetTemplateAction, deleteTimesheetTemplateAction } from "./actions";

export const metadata = { title: "Timesheet templates" };

export default async function TimesheetTemplatesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { user, branchId } = await requireUserWithBranch();
  const canEdit = isAdminRole(user.role);
  const mine = await prisma.timesheetTemplate.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheet templates"
        icon={LayoutTemplate}
        description="Layouts for the timesheets you send to clients. Pick one each time you generate a sheet. Customise a layout to make it your own: the wording, columns, header details, notes and signature boxes."
      />
      {error && <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-sm text-[var(--warning)]">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-primary">Your templates{mine.length ? ` · ${mine.length}` : ""}</h2>
        {mine.length === 0 ? (
          <p className="rounded-xl border border-dashed border-default px-4 py-6 text-center text-sm text-muted">
            {canEdit ? "None yet. Choose Customise on any layout below to make your own copy." : "None yet. An administrator can customise a layout below."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mine.map((t) => {
              const base = isTemplateKey(t.baseKey) ? templateByKey(t.baseKey) : templateByKey("standard");
              return (
                <section key={t.id} className="card flex flex-col gap-4 p-5 sm:flex-row">
                  <div className="w-full shrink-0 sm:w-40"><TemplatePreview k={base.key} /></div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-primary">{t.name}</h3>
                      <Badge color="blue">Yours</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-secondary">Based on {base.name}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                      {canEdit && <Link href={`/timesheet-templates/${t.id}`} className="btn btn-primary btn-sm gap-1.5"><Pencil className="h-3.5 w-3.5" aria-hidden />Edit</Link>}
                      <a href={`/api/timesheet-templates/sample?template=custom:${t.id}&format=pdf`} className="btn btn-secondary btn-sm gap-1.5"><FileText className="h-3.5 w-3.5" aria-hidden />PDF</a>
                      <a href={`/api/timesheet-templates/sample?template=custom:${t.id}&format=xlsx`} className="btn btn-secondary btn-sm gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />Excel</a>
                      {canEdit && (
                        <>
                          <form action={duplicateTimesheetTemplateAction}><input type="hidden" name="id" value={t.id} /><button type="submit" className="btn btn-secondary btn-sm gap-1.5"><Copy className="h-3.5 w-3.5" aria-hidden />Duplicate</button></form>
                          <DeleteButton action={deleteTimesheetTemplateAction} hiddenFields={{ id: t.id }} confirmMessage={`"${t.name}" is removed. Sheets already generated aren't affected.`} className="btn btn-secondary btn-sm gap-1.5 text-[var(--error)]" />
                        </>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-primary">Ready-made layouts</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {TIMESHEET_TEMPLATES.map((t) => (
            <section key={t.key} className="card flex flex-col gap-4 p-5 sm:flex-row">
              <div className="w-full shrink-0 sm:w-48">
                <TemplatePreview k={t.key} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-primary">{t.name}</h3>
                  <Badge color="slate">{t.orientation}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-secondary">{t.tagline}</p>
                <p className="mt-2 text-sm text-muted">{t.description}</p>
                <p className="mt-2 text-xs text-muted"><span className="font-medium text-secondary">Best for:</span> {t.bestFor}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {canEdit && (
                    <form action={customiseTemplateAction}>
                      <input type="hidden" name="baseKey" value={t.key} />
                      <button type="submit" className="btn btn-primary btn-sm gap-1.5"><Pencil className="h-3.5 w-3.5" aria-hidden />Customise</button>
                    </form>
                  )}
                  <a href={`/api/timesheet-templates/sample?template=${t.key}&format=pdf`} className="btn btn-secondary btn-sm gap-1.5">
                    <FileText className="h-3.5 w-3.5" aria-hidden /> Sample PDF
                  </a>
                  <a href={`/api/timesheet-templates/sample?template=${t.key}&format=xlsx`} className="btn btn-secondary btn-sm gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden /> Sample Excel
                  </a>
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>
      <p className="text-xs text-muted">Samples use made-up workers. Your real sheets use your letterhead, your workers and your figures.</p>
    </div>
  );
}
