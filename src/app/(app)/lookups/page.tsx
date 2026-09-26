import { ListChecks, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
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
    <div className="space-y-5">
      <PageHeader
        title="Lookups"
        icon={ListChecks}
        description={<>Manage the dropdown values used across employee forms.</>}
      />

      <div className="flex flex-wrap gap-1.5 rounded-card border border-default bg-surface p-2 shadow-card">
        {LOOKUP_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={`/lookups?category=${c.key}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              c.key === category
                ? "bg-[var(--brand-primary)] text-white"
                : "text-secondary hover:bg-surface-hover"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <form
        action={createLookupValueAction}
        className="card flex flex-wrap items-end gap-3 p-4"
      >
        <input type="hidden" name="category" value={category} />
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-muted">New value *</span>
          <input
            name="value"
            required
            placeholder="e.g. Welder"
            className="input w-full"
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4" aria-hidden />

          Add value
        </button>
      </form>

      {values.length === 0 ? (
        <p className="empty-state text-sm text-muted">
          No values yet for this category. Add one above.
        </p>
      ) : (
        <LookupValueList values={values.map((v) => ({ id: v.id, value: v.value, isActive: v.isActive }))} />
      )}
    </div>
  );
}
