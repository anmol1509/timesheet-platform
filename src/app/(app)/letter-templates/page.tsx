import { prisma } from "@/lib/db";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { LETTER_MERGE_FIELDS } from "@/lib/letterLayout";
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
          The body of each letter, edited here rather than buried in code.
          Placeholders below are filled in when the letter is generated.
        </p>
      </div>

      {/* Listed from LETTER_MERGE_FIELDS so this can't drift from what the
          renderer actually substitutes — it used to name a handful in prose. */}
      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium text-primary">
          Placeholders you can use ({LETTER_MERGE_FIELDS.length})
        </summary>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {LETTER_MERGE_FIELDS.map((f) => (
            <li key={f.key} className="text-sm">
              <code className="rounded bg-surface-sunken px-1 py-0.5 text-xs text-primary">
                %%{f.key}%%
              </code>
              <span className="ml-2 text-secondary">{f.label}</span>
              <span className="block text-xs text-subtle">e.g. {f.example}</span>
            </li>
          ))}
        </ul>
      </details>

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
