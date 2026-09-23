/**
 * SMS via Twilio's REST API (no SDK), config-gated like the WhatsApp and email
 * senders. Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either
 * TWILIO_SMS_FROM (a Twilio number / alphanumeric sender ID) or
 * TWILIO_MESSAGING_SERVICE_SID.
 */
export type SmsSendResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "request_failed"; detail?: string };

export function isSmsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_SMS_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID)
  );
}

export async function sendSms(to: string, body: string): Promise<SmsSendResult> {
  if (!isSmsConfigured()) return { sent: false, reason: "not_configured" };
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const params = new URLSearchParams({ To: to, Body: body });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) params.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  else params.set("From", process.env.TWILIO_SMS_FROM!);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[sms] Twilio failed (${res.status}): ${detail}`);
      return { sent: false, reason: "request_failed", detail };
    }
    return { sent: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`[sms] Twilio threw: ${detail}`);
    return { sent: false, reason: "request_failed", detail };
  }
}
