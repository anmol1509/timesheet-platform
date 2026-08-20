import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRenewals, summarise } from "@/lib/renewals";

/**
 * Daily sweep for documents falling due.
 *
 * Until now nothing in the app ran on a schedule: expiry was only ever
 * computed when somebody happened to open a page, so a passport lapsing while
 * the PRO was on leave went unnoticed. This runs per branch and returns a
 * digest.
 *
 * It currently reports rather than delivers — there's no mail or WhatsApp
 * credential in this project to send through, and inventing one would be a
 * decision, not a fix. Wire the send where marked once a channel is chosen;
 * the digest below is already the message body.
 */
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

  const digest = [];
  for (const branch of branches) {
    const items = await getRenewals(branch.id);
    const counts = summarise(items);
    const actionable = items.filter((i) => i.tier !== "horizon");

    digest.push({
      branch: branch.code,
      counts,
      // The first few by urgency — enough to act on without paging a whole
      // roster into an email.
      top: actionable.slice(0, 20).map((i) => ({
        subject: `${i.subjectName} (${i.subjectRef})`,
        kind: i.kind,
        document: i.document,
        days: i.days,
        expiry: i.expiry.slice(0, 10),
      })),
    });

    // Left in the server log so a run is traceable even before delivery exists.
    console.info(
      `[expiry-sweep] ${branch.code}: ${counts.expired} expired, ${counts.urgent} within 7d, ${counts.soon} within 30d, ${counts.planned} within 60d, ${counts.horizon} within 90d`
    );

    // TODO(delivery): send `digest` to the branch's PRO once a channel exists.
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), digest });
}
