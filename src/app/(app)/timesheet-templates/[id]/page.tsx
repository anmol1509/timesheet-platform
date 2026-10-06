import { notFound, redirect } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { isOutsideBranch } from "@/lib/branch";
import { isTemplateKey, templateByKey } from "@/lib/timesheetTemplates";
import { normalizeConfig, TEMPLATE_COLUMNS } from "@/lib/timesheetTemplateConfig";
import { TemplateEditor } from "./template-editor";

export const metadata = { title: "Edit timesheet template" };

export default async function EditTimesheetTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!isAdminRole(user.role)) redirect("/no-access");
  const row = await prisma.timesheetTemplate.findUnique({ where: { id } });
  if (!row || isOutsideBranch(row.branchId, branchId, isSuperAdmin) || !isTemplateKey(row.baseKey)) notFound();
  const base = templateByKey(row.baseKey);
  return (
    <div className="space-y-5">
      <PageHeader
        title={row.name}
        icon={LayoutTemplate}
        breadcrumbs={[{ label: "Timesheet templates", href: "/timesheet-templates" }, { label: row.name }]}
        description={`Based on ${base.name}. Change what is printed; the figures always come from your timesheet.`}
      />
      <TemplateEditor
        id={row.id}
        name={row.name}
        baseKey={row.baseKey}
        baseName={base.name}
        columns={row.baseKey === "standard" ? [] : TEMPLATE_COLUMNS[row.baseKey]}
        initial={normalizeConfig(row.baseKey, row.config)}
      />
    </div>
  );
}
