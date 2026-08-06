import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { LOOKUP_CATEGORIES } from "@/lib/lookupCategories";
import { createLookupValueAction } from "./actions";
import { LookupValueList } from "./lookup-value-list";

export default async function LookupsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: rawCategory } = await searchParams;
  const category = LOOKUP_CATEGORIES.some((c) => c.key === rawCategory)
    ? rawCategory!
    : LOOKUP_CATEGORIES[0].key;
  const { branchId } = await requireUserWithBranch();

  const values = await prisma.lookupValue.findMany({
    where: { ...branchWhere(branchId), category },
    orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Lookups</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage the dropdown values used across employee forms.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-2">
        {LOOKUP_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={`/lookups?category=${c.key}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              c.key === category
                ? "bg-[#166534] text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <form
        action={createLookupValueAction}
        className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4"
      >
        <input type="hidden" name="category" value={category} />
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">New value</span>
          <input
            name="value"
            required
            placeholder="e.g. Welder"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90"
        >
          + Add value
        </button>
      </form>

      {values.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No values yet for this category. Add one above.
        </p>
      ) : (
        <LookupValueList values={values.map((v) => ({ id: v.id, value: v.value, isActive: v.isActive }))} />
      )}
    </div>
  );
}
