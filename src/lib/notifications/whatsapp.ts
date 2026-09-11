/**
 * WhatsApp delivery for the expiry-sweep digest, via Twilio's WhatsApp API.
 *
 * No credentials exist in this project yet, so this stays a plain REST call
 * (no Twilio SDK dependency) gated on env vars — same "config-gate, don't
 * fail the caller" shape as the Anthropic document-extraction endpoint. Until
 * `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_WHATSAPP_FROM` are set,
 * every call is a no-op that logs why, so the cron route can call this
 * unconditionally.
 */
export type WhatsAppSendResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "no_recipients" | "request_failed"; detail?: string };

function isConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
  );
}

/** Recipients for the digest — comma-separated E.164 numbers, one env var for now. */
export function getExpiryDigestRecipients(): string[] {
  return (process.env.EXPIRY_DIGEST_WHATSAPP_TO || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

export async function sendWhatsAppMessage(to: string, body: string): Promise<WhatsAppSendResult> {
  if (!isConfigured()) {
    console.warn("[whatsapp] TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM not set — message not sent.");
    return { sent: false, reason: "not_configured" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_WHATSAPP_FROM!; // e.g. "whatsapp:+14155238886"

  const params = new URLSearchParams({
    To: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    Body: body,
  });

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      }
    );
    if (!response.ok) {
      const detail = await response.text();
      console.error(`[whatsapp] Twilio send failed (${response.status}): ${detail}`);
      return { sent: false, reason: "request_failed", detail };
    }
    return { sent: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`[whatsapp] Twilio send threw: ${detail}`);
    return { sent: false, reason: "request_failed", detail };
  }
}
