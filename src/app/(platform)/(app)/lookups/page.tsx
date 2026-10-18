import { ListChecks, Plus } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
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

  const [values, counts] = await Promise.all([
    prisma.lookupValue.findMany({
      where: { ...branchWhere(branchId), category },
      orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
    }),
    prisma.lookupValue.groupBy({ by: ["category"], where: branchWhere(branchId), _count: { _all: true } }),
  ]);
  const countBy = new Map(counts.map((c) => [c.category, c._count._all]));
  const empty = LOOKUP_CATEGORIES.filter((c) => !countBy.get(c.key)).length;
  const current = LOOKUP_CATEGORIES.find((c) => c.key === category)!;

  return (
    <div className="space-y-5">
      <HeroHeader
        icon={ListChecks}
        title="Lookups"
        subtitle="The dropdown values used across employee forms: trades, visa types, statuses and more."
        pills={[
          { label: "Lists", value: String(LOOKUP_CATEGORIES.length) },
          { label: "Values", value: String([...countBy.values()].reduce((n, c) => n + c, 0)) },
          { label: "Empty lists", value: String(empty), warn: empty > 0 },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
        <nav aria-label="Lookup lists" className="card h-fit p-2 lg:sticky lg:top-4">
          <ul className="flex gap-1 overflow-x-auto lg:max-h-[70vh] lg:flex-col lg:overflow-y-auto">
            {LOOKUP_CATEGORIES.map((c) => {
              const n = countBy.get(c.key) ?? 0;
              return (
                <li key={c.key} className="shrink-0">
                  <Link
                    href={`/lookups?category=${c.key}`}
                    aria-current={c.key === category ? "page" : undefined}
                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition ${
                      c.key === category ? "bg-brand-soft font-medium text-brand" : "text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    <span>{c.label}</span>
                    <span className={`tabular text-xs ${n === 0 ? "text-[var(--warning)]" : "text-muted"}`}>{n}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-4">
          <form action={createLookupValueAction} className="card flex flex-wrap items-end gap-3 p-4">
            <input type="hidden" name="category" value={category} />
            <label className="block flex-1 min-w-[180px]">
              <span className="mb-1 block text-xs font-medium text-muted">Add to {current.label} *</span>
              <input name="value" required placeholder={`New ${current.label.toLowerCase()} value`} className="input w-full" />
            </label>
            <button type="submit" className="btn btn-primary">
              <Plus className="h-4 w-4" aria-hidden />
              Add value
            </button>
          </form>

          {values.length === 0 ? (
            <p className="empty-state text-sm text-muted">
              {current.label} has no values yet, so forms fall back to free text or built-in defaults. Add the first one above.
            </p>
          ) : (
            <LookupValueList values={values.map((v) => ({ id: v.id, value: v.value, isActive: v.isActive }))} />
          )}
        </div>
      </div>
    </div>
  );
}
