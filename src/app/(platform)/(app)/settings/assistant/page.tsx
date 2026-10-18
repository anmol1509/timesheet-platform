import { MessageSquareWarning } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { prisma } from "@/lib/db";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { markFeedbackReviewedAction } from "./actions";

export const metadata = { title: "Assistant feedback" };

const day = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export default async function AssistantFeedbackPage() {
  const user = await requireAdmin();
  const branchId = user.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId() : user.branchId;
  const where = branchWhere(branchId);
  const since = daysAgo(30);
  const [open, up, down, unanswered] = await Promise.all([
    prisma.assistantFeedback.findMany({ where: { ...where, reviewed: false, OR: [{ rating: "DOWN" }, { unanswered: true }] }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.assistantFeedback.count({ where: { ...where, rating: "UP", createdAt: { gte: since } } }),
    prisma.assistantFeedback.count({ where: { ...where, rating: "DOWN", createdAt: { gte: since } } }),
    prisma.assistantFeedback.count({ where: { ...where, unanswered: true, createdAt: { gte: since } } }),
  ]);
  const rated = up + down;

  return (
    <div className="space-y-6">
      <HeroHeader
        icon={MessageSquareWarning}
        title="Assistant feedback"
        subtitle="Questions My Assistant could not resolve and answers marked not helpful. Each is a gap: fix the guide, then mark it reviewed."
        pills={[
          { label: "To review", value: String(open.length), warn: open.length > 0 },
          { label: "Helpful (30d)", value: rated > 0 ? `${up} · ${Math.round((up / rated) * 100)}%` : String(up) },
          { label: "Not helpful (30d)", value: String(down), warn: down > 0 },
          { label: "Unanswered (30d)", value: String(unanswered), warn: unanswered > 0 },
        ]}
      />
      <section className="card overflow-hidden">
        <h2 className="border-b border-default px-4 py-3 text-sm font-semibold text-primary">To review ({open.length})</h2>
        {open.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Nothing waiting. Questions the assistant can&apos;t resolve, and answers marked not helpful, will appear here.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {open.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="text-xs text-muted">
                    {day(f.createdAt)} · {f.userName}{f.page ? ` · ${f.page}` : ""} · {f.rating === "DOWN" ? "Marked not helpful" : "Could not resolve"}
                  </p>
                  <p className="font-medium text-primary">{f.question}</p>
                  <p className="line-clamp-3 whitespace-pre-line text-secondary">{f.answer}</p>
                  {f.comment && <p className="text-xs text-muted">Comment: {f.comment}</p>}
                </div>
                <form action={markFeedbackReviewedAction} className="shrink-0">
                  <input type="hidden" name="id" value={f.id} />
                  <button type="submit" className="btn btn-secondary h-8 px-3 text-xs">Mark reviewed</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
