import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRenewals, summarise } from "@/lib/renewals";
import { getExpiryDigestRecipients, sendWhatsAppMessage } from "@/lib/notifications/whatsapp";

/**
 * Daily sweep for documents falling due.
 *
 * Until now nothing in the app ran on a schedule: expiry was only ever
 * computed when somebody happened to open a page, so a passport lapsing while
 * the PRO was on leave went unnoticed. This runs per branch and returns a
 * digest.
 *
 * Delivery is via WhatsApp (Twilio) once TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/
 * TWILIO_WHATSAPP_FROM/EXPIRY_DIGEST_WHATSAPP_TO are set in the environment —
 * see src/lib/notifications/whatsapp.ts. Without those, sendWhatsAppMessage
 * no-ops and this still returns the JSON digest, same as before.
 */

function formatDigestMessage(branchName: string, counts: ReturnType<typeof summarise>, top: { subject: string; document: string; days: number }[]) {
  const lines = [
    `*Expiry sweep — ${branchName}*`,
    `Expired: ${counts.expired} · Within 7d: ${counts.urgent} · Within 30d: ${counts.soon}`,
    "",
    ...top.slice(0, 10).map((i) => {
      const runway = i.days < 0 ? `${Math.abs(i.days)}d overdue` : `${i.days}d left`;
      return `• ${i.subject} — ${i.document} (${runway})`;
    }),
  ];
  if (top.length > 10) lines.push(`…and ${top.length - 10} more.`);
  return lines.join("\n");
}
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without the secret
  // set this endpoint stays closed rather than silently public.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
  });

  const recipients = getExpiryDigestRecipients();

  const digest = [];
  for (const branch of branches) {
    const items = await getRenewals(branch.id);
    const counts = summarise(items);
    const actionable = items.filter((i) => i.tier !== "horizon");

    const top = actionable.slice(0, 20).map((i) => ({
      subject: `${i.subjectName} (${i.subjectRef})`,
      kind: i.kind,
      document: i.document,
      days: i.days,
      expiry: i.expiry.slice(0, 10),
    }));

    digest.push({ branch: branch.code, counts, top });

    // Left in the server log so a run is traceable even before delivery is configured.
    console.info(
      `[expiry-sweep] ${branch.code}: ${counts.expired} expired, ${counts.urgent} within 7d, ${counts.soon} within 30d, ${counts.planned} within 60d, ${counts.horizon} within 90d`
    );

    // Nothing due beyond the 90-day horizon means nothing worth a message.
    if (actionable.length === 0 || recipients.length === 0) continue;

    const message = formatDigestMessage(branch.name, counts, top);
    for (const to of recipients) {
      const result = await sendWhatsAppMessage(to, message);
      if (!result.sent) {
        console.warn(`[expiry-sweep] WhatsApp not delivered to ${to}: ${result.reason}`);
      }
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), digest });
}
