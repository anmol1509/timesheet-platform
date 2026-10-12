import { MessageSquareWarning } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { markFeedbackReviewedAction } from "./actions";

export const metadata = { title: "Assistant feedback" };

const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function AssistantFeedbackPage() {
  const user = await requireAdmin();
  const branchId = user.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId() : user.branchId;
  const where = branchWhere(branchId);
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [open, up, down, unanswered] = await Promise.all([
    prisma.assistantFeedback.findMany({ where: { ...where, reviewed: false, OR: [{ rating: "DOWN" }, { unanswered: true }] }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.assistantFeedback.count({ where: { ...where, rating: "UP", createdAt: { gte: since } } }),
    prisma.assistantFeedback.count({ where: { ...where, rating: "DOWN", createdAt: { gte: since } } }),
    prisma.assistantFeedback.count({ where: { ...where, unanswered: true, createdAt: { gte: since } } }),
  ]);
  const rated = up + down;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assistant feedback"
        description="Questions My Assistant could not resolve and answers people marked not helpful. Each one is a gap in the help it gives: add or fix a guide, then mark it reviewed."
        icon={MessageSquareWarning}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs text-muted">Helpful (last 30 days)</p><p className="mt-1 text-2xl font-semibold text-primary">{up}</p>{rated > 0 && <p className="text-xs text-muted">{Math.round((up / rated) * 100)}% of {rated} rated</p>}</div>
        <div className="card p-4"><p className="text-xs text-muted">Not helpful (last 30 days)</p><p className="mt-1 text-2xl font-semibold text-primary">{down}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">Could not resolve (last 30 days)</p><p className="mt-1 text-2xl font-semibold text-primary">{unanswered}</p></div>
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-default px-4 py-3 text-sm font-semibold text-primary">To review ({open.length})</h2>
        {open.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Nothing waiting. Questions the assistant can't resolve, and answers marked not helpful, will appear here.</p>
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
