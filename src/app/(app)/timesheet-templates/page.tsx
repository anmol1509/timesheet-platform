import { LayoutTemplate, FileSpreadsheet, FileText } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { TemplatePreview } from "@/components/TimesheetTemplatePicker";
import { TIMESHEET_TEMPLATES } from "@/lib/timesheetTemplates";

export const metadata = { title: "Timesheet templates" };

export default function TimesheetTemplatesPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Timesheet templates"
        icon={LayoutTemplate}
        description="Ready-made layouts for the timesheets you send to clients. Choose one each time you generate a sheet, whether for one company or many at once. Download a sample to see exactly how it prints."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TIMESHEET_TEMPLATES.map((t) => (
          <section key={t.key} className="card flex flex-col gap-4 p-5 sm:flex-row">
            <div className="w-full shrink-0 sm:w-48">
              <TemplatePreview k={t.key} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-primary">{t.name}</h2>
                <Badge color="slate">{t.orientation}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-secondary">{t.tagline}</p>
              <p className="mt-2 text-sm text-muted">{t.description}</p>
              <p className="mt-2 text-xs text-muted"><span className="font-medium text-secondary">Best for:</span> {t.bestFor}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
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
      <p className="text-xs text-muted">Samples use made-up workers. Your real sheets use your letterhead, your workers and your figures.</p>
    </div>
  );
}
