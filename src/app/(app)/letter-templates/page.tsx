import { prisma } from "@/lib/db";
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
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Letter Templates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage NOC/letter bodies. Use <code>%%CLIENTNAME%%</code>, <code>%%PROJECTNAME%%</code>,{" "}
          <code>%%SPONSORSHIPCOMPANYNAME%%</code>, <code>%%BRANCHNAME%%</code>, <code>%%DOCNO%%</code>,{" "}
          <code>%%MOBILIZEDATE%%</code> as merge fields — they&apos;re substituted when a NOC is generated.
        </p>
      </div>

      <form
        action={createLetterTemplateAction}
        className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Name</span>
            <input
              name="name"
              required
              placeholder="e.g. Standard NOC"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Category</span>
            <select
              name="category"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
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
          <span className="mb-1 block text-xs font-medium text-slate-500">Letter body</span>
          <textarea
            name="remarksText"
            required
            rows={6}
            placeholder="This is to certify that %%SPONSORSHIPCOMPANYNAME%% has no objection to..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          + Add template
        </button>
      </form>

      {templates.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No letter templates yet. Add one above.
        </p>
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
