import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { COPILOT_MODEL } from "@/lib/constants";
import { requireImporter } from "@/lib/importer/access";
import { rateLimit } from "@/lib/rateLimit";
import { EMPLOYEE_DOC_TYPES, SUPPLIER_DOC_TYPE_OPTIONS } from "@/lib/importer/documentMatch";
import type { Audience, PageRead } from "@/lib/importer/documentRead";

export const maxDuration = 60;

const MAX_PAGES_PER_CALL = 8;
const READ_LIMIT = { limit: 900, windowMs: 60 * 60 * 1000 };

const schemaFor = (types: string[]) => ({
  type: "object" as const,
  properties: {
    pages: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          ref: { type: "string" as const },
          type: { type: "string" as const, enum: types },
          continuation: { type: "boolean" as const, description: "True when this page is the back or a later page of the same document as the page before it." },
          blank: { type: "boolean" as const, description: "True for a blank page, a fax cover or a page with nothing to file." },
          holder: { type: "string" as const, description: "Full name of the person or company the document was issued to, as printed. Empty if not shown." },
          idNumber: { type: "string" as const, description: "The document's own number (passport no., Emirates ID, labour card no., visa file no., licence no.). Empty if not shown." },
          expiry: { type: "string" as const, description: "Expiry date as YYYY-MM-DD, or empty if the page shows none." },
          confidence: { type: "string" as const, enum: ["high", "medium", "low"] },
        },
        required: ["ref", "type", "continuation", "blank", "holder", "idNumber", "expiry", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["pages"],
  additionalProperties: false,
});

const systemFor = (audience: Audience, labels: string) => `You sort scanned paperwork for a UAE manpower company. You are shown pages in order, from one file.
For each page say which document it is, using exactly one of these types: ${labels}. Use OTHER only when none fit.
${audience === "EMPLOYEE"
  ? "The documents belong to workers: passport bio-data page, Emirates ID (front and back are separate pages of ONE document), visa or residence page, MOHRE labour card / work permit, medical certificate, insurance and so on."
  : "The documents belong to supplier companies: trade licence, MOHRE permit, establishment card, insurance, Ejari / tenancy, chamber of commerce certificate, TRN certificate, contracts."}
Rules: a page that carries on the document before it (back of a card, page 2 of a licence) has continuation=true; the first page of any new document has continuation=false, even if the same person is on both. Read the holder's name and the document number exactly as printed. Dates must be YYYY-MM-DD (convert 19/Apr/2028 to 2028-04-19). Give an empty string for anything you cannot read with confidence and never guess. Set confidence low when the page is unclear.
Return one entry per page, in the order given, with the same ref.`;

/** Reads a few pages and says what each is. Nothing is stored; the page images are not kept. */
export async function POST(request: Request) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI reading isn't switched on." }, { status: 503 });
  const budget = rateLimit(`docread:${who.user.id}`, READ_LIMIT);
  if (!budget.allowed) return NextResponse.json({ error: "A lot of pages were read in the last hour. Try again shortly." }, { status: 429, headers: { "Retry-After": String(budget.retryAfter) } });

  const body = (await request.json().catch(() => null)) as { audience?: Audience; pages?: { ref?: string; image?: string }[] } | null;
  const audience: Audience = body?.audience === "SUPPLIER" ? "SUPPLIER" : "EMPLOYEE";
  const pages = (body?.pages ?? []).filter((p) => p && typeof p.ref === "string" && typeof p.image === "string" && p.image.length > 100).slice(0, MAX_PAGES_PER_CALL);
  if (pages.length === 0) return NextResponse.json({ error: "No pages." }, { status: 400 });

  const options = audience === "EMPLOYEE" ? EMPLOYEE_DOC_TYPES : SUPPLIER_DOC_TYPE_OPTIONS;
  const types = options.map((t) => t.value);
  try {
    const client = new Anthropic({ maxRetries: 1, timeout: 50_000 });
    const content: Anthropic.ContentBlockParam[] = [];
    for (const p of pages) {
      content.push({ type: "text", text: `Page ref ${p.ref}:` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.image!.replace(/^data:image\/jpeg;base64,/, "") } });
    }
    content.push({ type: "text", text: "Read every page above." });
    const res = await client.messages.create({
      model: COPILOT_MODEL,
      max_tokens: 1800,
      system: systemFor(audience, options.map((t) => `${t.value} (${t.label})`).join(", ")),
      output_config: { format: { type: "json_schema", schema: schemaFor(types) } },
      messages: [{ role: "user", content }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (res.stop_reason === "refusal" || text?.type !== "text") return NextResponse.json({ error: "The AI couldn't read these pages." }, { status: 422 });
    const parsed = JSON.parse(text.text) as { pages?: Partial<PageRead>[] };
    const byRef = new Map((parsed.pages ?? []).map((r) => [String(r.ref), r]));
    // Every page asked about comes back, in order: one the model skipped is treated as unreadable.
    const out: PageRead[] = pages.map((p) => {
      const r = byRef.get(p.ref!);
      const type = r?.type && types.includes(r.type) ? r.type : "OTHER";
      const expiry = typeof r?.expiry === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.expiry) ? r.expiry : "";
      return {
        ref: p.ref!, type, continuation: !!r?.continuation, blank: !!r?.blank,
        holder: String(r?.holder ?? "").slice(0, 120), idNumber: String(r?.idNumber ?? "").slice(0, 60), expiry,
        confidence: r?.confidence === "high" || r?.confidence === "medium" ? r.confidence : "low",
      };
    });
    return NextResponse.json({ pages: out });
  } catch (e) {
    const status = typeof e === "object" && e && "status" in e ? Number((e as { status: unknown }).status) : 0;
    console.error("[import-documents-analyze] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: status === 429 ? "The AI is busy right now. Try again in a moment." : "The AI couldn't read these pages." }, { status: 502 });
  }
}
