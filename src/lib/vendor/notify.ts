import { prisma } from "@/lib/db";

/**
 * Puts a message in a supplier's portal inbox. Never throws: a failed
 * notification must not fail the business action that caused it.
 */
export async function notifySupplier(input: { supplierId: string; kind: string; title: string; body?: string | null; href?: string | null }) {
  try {
    await prisma.supplierNotification.create({
      data: { supplierId: input.supplierId, kind: input.kind, title: input.title, body: input.body ?? null, href: input.href ?? null },
    });
  } catch (e) {
    console.warn("[supplier-notify] not delivered:", e instanceof Error ? e.message : e);
  }
}
