import { prisma } from "@/lib/db";

type AuditAction = "CREATE" | "UPDATE" | "DELETE";

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
}) {
  const { entityType, entityId, action, before, after, userId, userName, branchId } = params;
  const changes: object =
    action === "UPDATE" && before && after ? diffFields(before, after) : (after ?? before ?? {});

  await prisma.auditLog.create({
    data: {
      entityType,
      entityId,
      action,
      changes,
      userId,
      userName,
      branchId: branchId ?? null,
    },
  });
}
