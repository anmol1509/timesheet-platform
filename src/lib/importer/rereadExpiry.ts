import Anthropic from "@anthropic-ai/sdk";
import { COPILOT_MODEL } from "@/lib/constants";
import { pickExpiry } from "@/lib/expiryPick";

export type ExpiryRead = { expiry: string | null; issue: string | null; confidence: "high" | "medium" | "low" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const SCHEMA = {
  type: "object" as const,
  properties: {
    issue: { type: "string" as const, description: "Date of issue as YYYY-MM-DD, or empty if the document prints none." },
    expiry: { type: "string" as const, description: "Date of expiry as YYYY-MM-DD, the date under the label Expiry Date (or Date of expiry / valid until). Empty if none." },
    confidence: { type: "string" as const, enum: ["high", "medium", "low"] },
  },
  required: ["issue", "expiry", "confidence"],
  additionalProperties: false,
};

const SYSTEM = `You read one scanned UAE identity or work document and report its issue date and its expiry date.
Go by the label printed next to or under each date, never by position: on a residence visa the Issue Date and Expiry Date sit side by side along the bottom edge and can be on either side. The expiry is always later than the issue (usually one to three years for a visa or Emirates ID, five or ten for a passport). On a passport the machine-readable line at the bottom has the expiry as YYMMDD right after the sex letter; use it to confirm. A passport's other pages can print the previous passport (Old passport No., date and place of issue of the old one, or an amendment stamp): those dates are never the expiry. Take the expiry from the bio-data page, from the date under Date of expiry, and confirm it with the machine-readable line. On an Emirates ID the second line of the machine-readable block on the back has the date of birth, a check digit, the sex letter and then the expiry as YYMMDD.
Never report the date of birth or a date from a stamp or signature. Never work out an expiry by adding a validity period to an issue date, and never use the date of a form, report, application or certificate as the expiry: if the document does not print an expiry, return an empty string. Dates must be YYYY-MM-DD (convert 19/Apr/2028 to 2028-04-19; UAE dates print day first). Give an empty string for anything you cannot read with confidence and never guess.`;

/** Reads a stored scan again and says what dates it shows. Used to check expiries that were read wrongly the first time. */
export async function rereadExpiry(file: { bytes: Uint8Array; mime: string; type: string }): Promise<ExpiryRead | { error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "AI reading isn't switched on." };
  const data = Buffer.from(file.bytes).toString("base64");
  const block: Anthropic.ContentBlockParam =
    file.mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : /^image\/(jpeg|png|gif|webp)$/.test(file.mime)
        ? { type: "image", source: { type: "base64", media_type: file.mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data } }
        : (null as never);
  if (!block) return { error: "This file type can't be read." };
  try {
    const client = new Anthropic({ maxRetries: 1, timeout: 50_000 });
    const res = await client.messages.create({
      model: COPILOT_MODEL,
      max_tokens: 400,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: [block, { type: "text", text: `This is a ${file.type.replace(/_/g, " ").toLowerCase()}. What are its issue and expiry dates?` }] }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (res.stop_reason === "refusal" || text?.type !== "text") return { error: "The AI couldn't read this file." };
    const parsed = JSON.parse(text.text) as { issue?: string; expiry?: string; confidence?: string };
    const confidence = parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low";
    return { expiry: pickExpiry(parsed), issue: parsed.issue && ISO.test(parsed.issue) ? parsed.issue : null, confidence };
  } catch (e) {
    console.error("[reread-expiry] failed:", e instanceof Error ? e.message : e);
    return { error: "The AI couldn't read this file." };
  }
}
