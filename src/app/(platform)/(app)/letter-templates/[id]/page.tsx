import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { presetByKey } from "@/lib/letterPresets";
import { templateHtml } from "@/lib/letterHtml";
import { TemplateEditor } from "./template-editor";

export const metadata = { title: "Edit letter template" };

export default async function LetterTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const template = await prisma.letterTemplate.findUnique({ where: { id } });
  if (!template || isOutsideBranch(template.branchId, branchId, isSuperAdmin)) notFound();
  const usedBy = await prisma.noc.count({ where: { templateId: id } });

  return (
    <div className="space-y-5">
      <div>
        <Link href="/letter-templates" className="text-xs text-muted hover:text-secondary">← Letter templates</Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-primary">{template.name}</h1>
        <p className="mt-1 text-sm text-muted">Edit the wording on the left; the letter updates on the right as you type.</p>
      </div>
      <TemplateEditor
        key={template.id + template.createdAt.getTime()}
        id={template.id}
        audience={template.audience === "EMPLOYEE" ? "EMPLOYEE" : "SITE"}
        name={template.name}
        category={template.category ?? ""}
        title={template.title ?? ""}
        html={templateHtml(template)}
        hasPreset={!!presetByKey(template.presetKey)}
        usedBy={usedBy}
      />
    </div>
  );
}
