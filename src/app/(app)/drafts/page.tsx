import Link from "next/link";
import { FileClock, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { DRAFT_TYPES, isDraftType } from "@/lib/draftTypes";
import { discardDraftByIdAction } from "./actions";

export const metadata = { title: "Drafts" };

const ago = (d: Date, now: Date) => {
  const mins = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const days = Math.round(h / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

/** Everything this person has started but not finished. Drafts are private to them. */
export default async function DraftsPage() {
  const { user } = await requireUserWithBranch();
  const drafts = await prisma.draft.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 100 });
  const now = new Date();

  return (
    <div className="space-y-5">
      <PageHeader title="Drafts" description="Forms you started and haven't finished. Open one to pick up where you left off." />
      {drafts.length === 0 ? (
        <EmptyState icon={FileClock} title="No drafts" description="When you save a form as a draft, or leave one part-filled, it appears here so you can finish it later on any device." />
      ) : (
        <ul className="card divide-y divide-[var(--border)] overflow-hidden">
          {drafts.filter((d) => isDraftType(d.type)).map((d) => {
            const meta = DRAFT_TYPES[d.type as keyof typeof DRAFT_TYPES];
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <FileClock className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">{d.title || `Untitled ${meta.label.toLowerCase()}`}</p>
                  <p className="text-xs text-muted">{meta.label} · saved {ago(d.updatedAt, now)}</p>
                </div>
                <Link href={meta.href} className="btn btn-primary btn-sm">Continue</Link>
                <form action={discardDraftByIdAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className="btn btn-secondary btn-sm gap-1.5" aria-label={`Discard draft ${d.title ?? ""}`}><Trash2 className="h-3.5 w-3.5" aria-hidden />Discard</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
