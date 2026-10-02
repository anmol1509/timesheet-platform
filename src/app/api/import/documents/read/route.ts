import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { COPILOT_MODEL } from "@/lib/constants";
import { requireImporter } from "@/lib/importer/access";
import { extOf } from "@/lib/importer/documentMatch";
import { MAX_BULK_FILE_BYTES } from "@/lib/importer/documentLimits";

export const maxDuration = 60;

const SCHEMA = {
  type: "object" as const,
  properties: {
    type: { type: "string" as const, enum: ["PASSPORT", "EMIRATES_ID", "VISA", "LABOR_CARD", "RESIDENCY_ISSUANCE", "MEDICAL", "CICPA", "INSURANCE", "DRIVING_LICENCE", "TRADE_LICENSE", "MOHRE_PERMIT", "WORKMEN_COMPENSATION_INSURANCE", "ESTABLISHMENT_CARD", "EJARI_TENANCY", "CHAMBER_OF_COMMERCE", "TRN_CERTIFICATE", "CONTRACT", "OTHER"] },
    expiry: { type: ["string", "null"] as unknown as "string", description: "Expiry date as YYYY-MM-DD, or null if the document shows none." },
    holder: { type: ["string", "null"] as unknown as "string", description: "Name of the person or company the document was issued to, or null." },
  },
  required: ["type", "expiry", "holder"],
  additionalProperties: false,
};

/** Optional, one file at a time: reads one document's type, expiry date and holder name. Nothing is stored. */
export async function POST(request: Request) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI reading isn't switched on." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BULK_FILE_BYTES) return NextResponse.json({ error: "Send one file under 4 MB." }, { status: 400 });
  const ext = extOf(file.name);
  const media = ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" } as Record<string, string>)[ext];
  if (!media) return NextResponse.json({ error: "AI can read PDFs and JPG, PNG, GIF or WebP images." }, { status: 400 });
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const client = new Anthropic({ maxRetries: 0, timeout: 40_000 });
    const block = media === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
      : ({ type: "image", source: { type: "base64", media_type: media as "image/jpeg", data } } as const);
    const res = await client.messages.create({
      model: COPILOT_MODEL,
      max_tokens: 400,
      system: "You read identity, visa, licence and company documents for a UAE manpower company. Report the document type, its expiry date (YYYY-MM-DD) and who it was issued to. Use null when something isn't shown. Answer only with the requested JSON.",
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: [block, { type: "text", text: "What is this document?" }] }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (res.stop_reason === "refusal" || text?.type !== "text") return NextResponse.json({ error: "AI couldn't read this one." }, { status: 422 });
    const out = JSON.parse(text.text) as { type: string; expiry: string | null; holder: string | null };
    return NextResponse.json({ type: out.type, expiry: out.expiry && /^\d{4}-\d{2}-\d{2}$/.test(out.expiry) ? out.expiry : null, holder: out.holder });
  } catch {
    return NextResponse.json({ error: "AI couldn't read this one. You can set it by hand." }, { status: 502 });
  }
}
