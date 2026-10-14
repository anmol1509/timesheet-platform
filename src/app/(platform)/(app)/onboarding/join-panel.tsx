import Link from "next/link";
import { CheckCircle2, UserPlus } from "lucide-react";

/** Where a candidate stands on becoming an employee: already one, ready to be added, or still to finish (and addable early as an exception). */
export function JoinPanel({
  candidate,
}: {
  candidate: { id: string; readyToJoin: boolean; joined: boolean; joiningDate: Date | null; employeeId: string | null };
}) {
  if (candidate.joined) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success-text,#067647)]">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        Joined{candidate.joiningDate ? ` on ${new Date(candidate.joiningDate).toLocaleDateString("en-GB")}` : ""}
        {candidate.employeeId && (
          <>
            {" · "}
            <Link href={`/employees/${candidate.employeeId}`} className="underline hover:no-underline">
              View employee record
            </Link>
          </>
        )}
      </div>
    );
  }

  const href = `/onboarding/${candidate.id}/add-employee`;
  if (candidate.readyToJoin) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--success-soft)] px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-[var(--success-text,#067647)]"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Ready to join. You can add them to employees now.</p>
        <Link href={href} className="btn btn-primary"><UserPlus className="h-4 w-4" aria-hidden /> Add to employees</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-subtle px-4 py-3">
      <p className="text-sm text-muted">The steps above aren&rsquo;t all complete yet (the papers after arrival are not needed). You can still add them early if you need to.</p>
      <Link href={href} className="btn btn-secondary"><UserPlus className="h-4 w-4" aria-hidden /> Add early</Link>
    </div>
  );
}
