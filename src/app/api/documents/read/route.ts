import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { COPILOT_MODEL } from "@/lib/constants";
import { requireUserWithBranch } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const READ_LIMIT = { limit: 300, windowMs: 60 * 60 * 1000 };
const MEDIA: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };

const SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const, description: "A short name for this document as a person would file it, e.g. \"Fire safety certificate\", \"Offer letter\", \"Insurance policy\". No file extension. Empty if you cannot tell." },
    expiry: { type: "string" as const, description: "The date the document expires or stops being valid as YYYY-MM-DD, only if the document prints one. Empty otherwise." },
  },
  required: ["name", "expiry"],
  additionalProperties: false,
};

/**
 * Reads one file for the "Other documents" forms: a name to file it under and its expiry date, when it shows one. Nothing is
 * stored; the form shows what was read and the person can change it before saving.
 */
export async function POST(request: Request) {
  const { user } = await requireUserWithBranch();
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI reading isn't switched on." }, { status: 503 });
  const budget = rateLimit(`otherdocread:${user.id}`, READ_LIMIT);
  if (!budget.allowed) return NextResponse.json({ error: "A lot of files were read in the last hour. Try again shortly." }, { status: 429, headers: { "Retry-After": String(budget.retryAfter) } });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "Send one file under 4 MB." }, { status: 400 });
  const media = MEDIA[(/\.([A-Za-z0-9]+)$/.exec(file.name)?.[1] ?? "").toLowerCase()];
  if (!media) return NextResponse.json({ error: "AI can read PDFs and JPG, PNG, GIF or WebP images." }, { status: 400 });
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const client = new Anthropic({ maxRetries: 0, timeout: 40_000 });
    const block = media === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
      : ({ type: "image", source: { type: "base64", media_type: media as "image/jpeg", data } } as const);
    const res = await client.messages.create({
      model: COPILOT_MODEL,
      max_tokens: 300,
      system: "You file paperwork for a UAE manpower company. Say what the document is in a few words and, only when the document itself prints one, the date it expires or stops being valid (YYYY-MM-DD). Never work an expiry out by adding a period to an issue date, and never use the date of a letter, form or report as the expiry. Answer only with the requested JSON.",
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: [block, { type: "text", text: "What should this document be called, and when does it expire?" }] }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (res.stop_reason === "refusal" || text?.type !== "text") return NextResponse.json({ error: "AI couldn't read this one." }, { status: 422 });
    const out = JSON.parse(text.text) as { name?: string; expiry?: string };
    return NextResponse.json({ name: String(out.name ?? "").trim().slice(0, 100), expiry: /^\d{4}-\d{2}-\d{2}$/.test(String(out.expiry ?? "")) ? out.expiry : "" });
  } catch {
    return NextResponse.json({ error: "AI couldn't read this one. You can fill it in by hand." }, { status: 502 });
  }
}
