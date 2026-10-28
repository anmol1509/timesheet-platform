import Link from "next/link";
import { CheckCircle2, UserPlus } from "lucide-react";

/** Where a candidate stands on becoming an employee: already one, ready to be added, or still to finish (and addable early as an exception). */
export function JoinPanel({
  candidate,
  canEdit = true,
  missingDocs = [],
}: {
  candidate: { id: string; readyToJoin: boolean; joined: boolean; joiningDate: Date | null; employeeId: string | null };
  /** False for a person who may only look: no button to add the candidate. */
  canEdit?: boolean;
  /** Required documents not on file yet; adding them to employees asks for a second look until they are. */
  missingDocs?: string[];
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
        {canEdit && <Link href={href} className="btn btn-primary"><UserPlus className="h-4 w-4" aria-hidden /> Add to employees</Link>}
        {missingDocs.length > 0 && <p className="w-full text-xs text-[var(--warning-text,#92400e)]">Required documents not on file yet: {missingDocs.join(", ")}. You will be asked to confirm before adding.</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-subtle px-4 py-3">
      <p className="text-sm text-muted">The steps above aren&rsquo;t all complete yet (the papers after arrival are not needed). You can still add them early if you need to.</p>
      {canEdit && <Link href={href} className="btn btn-secondary"><UserPlus className="h-4 w-4" aria-hidden /> Add early</Link>}
    </div>
  );
}
