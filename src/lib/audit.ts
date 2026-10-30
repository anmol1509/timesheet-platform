import { prisma } from "@/lib/db";
import { emitFromAudit } from "@/lib/webhooks/fromAudit";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "VIEW";

/** Where a change came from. Entries written before this existed have none and read as the screen. */
export type AuditSource = "SCREEN" | "REVERT" | "IMPORT" | "API" | "SYSTEM";

function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { from: before[key] ?? null, to: after[key] ?? null };
    }
  }
  return changes;
}

// Call after every mutating create/update/delete in an actions.ts file.
// UPDATE stores only the fields that actually changed; CREATE/DELETE store
// the full before/after snapshot since there's nothing to diff against.
export async function logAudit(params: {
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  userId: string;
  userName: string;
  branchId?: string | null;
  source?: AuditSource;
  /** Entries from one bulk action share this id, so the log can show them as one line. */
  batchId?: string;
  batchLabel?: string;
  /** The earlier entry this one puts back. */
  revertOfId?: string;
}): Promise<string | null> {
  const { entityType, entityId, action, before, after, userId, userName, branchId, source, batchId, batchLabel, revertOfId } = params;
  const changes: object =
    action === "UPDATE" && before && after ? diffFields(before, after) : (after ?? before ?? {});

  // Never let a failed audit-log write take down the action that triggered
  // it (same principle as notifyUsers) — by the time this runs, the actual
  // create/update/delete has already committed.
  let id: string | null = null;
  try {
    const row = await prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        changes,
        userId,
        userName,
        branchId: branchId ?? null,
        source: source ?? "SCREEN",
        batchId: batchId ?? null,
        batchLabel: batchLabel ?? null,
        revertOfId: revertOfId ?? null,
      },
      select: { id: true },
    });
    id = row.id;
  } catch (e) {
    console.error("[audit] failed to log:", e instanceof Error ? e.message : e);
  }

  // Customers listening for webhooks hear about the changes that matter. A failure here must not touch the action.
  try {
    await emitFromAudit({ entityType, entityId, action, after, changes, branchId });
  } catch (e) {
    console.error("[webhooks] audit hook failed:", e instanceof Error ? e.message : e);
  }
  return id;
}

/**
 * A change to something that hangs off a main record (a contact, a rate, a holiday) is logged as an edit to that
 * record, so the record's own history shows it: "changed project X's contact from empty to Ahmed (Site engineer)".
 */
export async function logChildChange(p: {
  parentType: "PROJECT" | "CLIENT";
  parentId: string;
  /** A short word for what changed, such as "contact", "holiday" or "rate_welder". */
  field: string;
  from: unknown;
  to: unknown;
  user: { id: string; name: string };
  branchId: string | null;
}) {
  return logAudit({
    entityType: p.parentType,
    entityId: p.parentId,
    action: "UPDATE",
    before: { [p.field]: p.from ?? null },
    after: { [p.field]: p.to ?? null },
    userId: p.user.id,
    userName: p.user.name,
    branchId: p.branchId,
  });
}

/** "Ahmed (Site engineer, 0501234567)" */
export const describeContact = (c: { name: string; role?: string | null; designation?: string | null; phone?: string | null; email?: string | null }) => {
  const extra = [c.role ?? c.designation, c.phone, c.email].filter(Boolean).join(", ");
  return extra ? `${c.name} (${extra})` : c.name;
};
