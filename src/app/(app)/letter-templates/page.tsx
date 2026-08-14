import { prisma } from "@/lib/db";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { createLetterTemplateAction } from "./actions";
import { LetterTemplateList } from "./letter-template-list";

const CATEGORIES = [
  "No Objection Letter",
  "Mobilization Letter",
  "Undertaking Letter",
  "Supplier Undertaking",
];

export default async function LetterTemplatesPage() {
  const { branchId } = await requireUserWithBranch();

  const templates = await prisma.letterTemplate.findMany({
    where: branchWhere(branchId),
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">Letter Templates</h1>
        <p className="mt-1 text-sm text-muted">
          Manage NOC/letter bodies. Use <code>%%CLIENTNAME%%</code>, <code>%%PROJECTNAME%%</code>,{" "}
          <code>%%SPONSORSHIPCOMPANYNAME%%</code>, <code>%%BRANCHNAME%%</code>, <code>%%DOCNO%%</code>,{" "}
          <code>%%MOBILIZEDATE%%</code> as merge fields — they&apos;re substituted when a NOC is generated.
        </p>
      </div>

      <form
        action={createLetterTemplateAction}
        className="card space-y-3 p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Name</span>
            <input
              name="name"
              required
              placeholder="e.g. Standard NOC"
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Category</span>
            <select
              name="category"
              className="input w-full"
            >
              <option value="">Not set</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Letter body</span>
          <textarea
            name="remarksText"
            required
            rows={6}
            placeholder="This is to certify that %%SPONSORSHIPCOMPANYNAME%% has no objection to..."
            className="input w-full"
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary"
        >
          + Add template
        </button>
      </form>

      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No letter templates yet"
          description="Templates use %%PLACEHOLDER%% merge fields that get filled from employee records when a letter is generated. Add one above to get started."
        />
      ) : (
        <LetterTemplateList
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            category: t.category,
          }))}
        />
      )}
    </div>
  );
}
