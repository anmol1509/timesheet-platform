import Anthropic from "@anthropic-ai/sdk";
import { COPILOT_MODEL, thinkingOff } from "@/lib/constants";
import { aiGate, recordAiUsage } from "@/lib/aiCreditsServer";

/** Shared by the routes that read a bill or invoice, or a worker's ID papers, for the person to check before saving. */
export const READ_MAX_BYTES = 4 * 1024 * 1024;
const MEDIA: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const str = (description: string) => ({ type: "string" as const, description });
const SCHEMAS = {
  invoice: {
    type: "object" as const,
    properties: {
      invoiceNo: str("The invoice or bill number as printed. Empty if none."),
      date: str("Invoice date as YYYY-MM-DD. Empty if not printed."),
      dueDate: str("Payment due date as YYYY-MM-DD, only if printed. Empty otherwise."),
      amount: str("Total BEFORE VAT, digits and a decimal point only. Empty if you cannot tell."),
      vat: str("VAT / tax amount, digits and a decimal point only. \"0\" if the invoice shows none."),
      description: str("What it is for, under 10 words, e.g. \"Labour supply, August\". Empty if unclear."),
    },
    required: ["invoiceNo", "date", "dueDate", "amount", "vat", "description"],
    additionalProperties: false,
  },
  person: {
    type: "object" as const,
    properties: {
      name: str("Full name as printed. Empty if not shown."),
      dateOfBirth: str("Date of birth as YYYY-MM-DD. Empty if not shown."),
      nationality: str("Nationality as printed. Empty if not shown."),
      passportNumber: str("Passport number, only when this is a passport. Empty otherwise."),
      passportExpiry: str("Passport expiry (Date of expiry, NOT issue) as YYYY-MM-DD, only when this is a passport. Empty otherwise."),
      emiratesId: str("15-digit Emirates ID number (784-...), only when this is an Emirates ID. Empty otherwise."),
      emiratesIdExpiry: str("Emirates ID expiry as YYYY-MM-DD, only when this is an Emirates ID. Empty otherwise."),
    },
    required: ["name", "dateOfBirth", "nationality", "passportNumber", "passportExpiry", "emiratesId", "emiratesIdExpiry"],
    additionalProperties: false,
  },
};
const PROMPTS = {
  invoice: "Read this supplier invoice or bill for a UAE business. Report only what the document prints, never guess a figure. The amount is the total before VAT.",
  person: "Read this passport or UAE Emirates ID. Report only what the document prints. Never work an expiry out from an issue date.",
};
const DATE_FIELDS = new Set(["date", "dueDate", "dateOfBirth", "passportExpiry", "emiratesIdExpiry"]);

export type ReadKind = keyof typeof SCHEMAS;
export type ReadResult = { status: number; error: string } | { status: 200; fields: Record<string, string> };

/** Reads one uploaded file as the given kind. The caller has already checked who is asking; this checks the credit gate and records usage. */
export async function readFileFields(kind: ReadKind, file: unknown, ctx: { branchId: string | null; userId: string | null; feature: string }): Promise<ReadResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { status: 503, error: "AI reading isn't switched on." };
  const gate = await aiGate(ctx.branchId);
  if (gate) return { status: 402, error: gate };
  if (!(file instanceof File) || file.size === 0 || file.size > READ_MAX_BYTES) return { status: 400, error: "Send one file under 4 MB." };
  const media = MEDIA[(/\.([A-Za-z0-9]+)$/.exec(file.name)?.[1] ?? "").toLowerCase()];
  if (!media) return { status: 400, error: "AI can read PDFs and JPG, PNG, GIF or WebP images." };
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const client = new Anthropic({ maxRetries: 0, timeout: 40_000 });
    const block = media === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
      : ({ type: "image", source: { type: "base64", media_type: media as "image/jpeg", data } } as const);
    const res = await client.messages.create({
      model: COPILOT_MODEL,
      ...thinkingOff(COPILOT_MODEL),
      max_tokens: 500,
      output_config: { format: { type: "json_schema", schema: SCHEMAS[kind] } },
      messages: [{ role: "user", content: [block, { type: "text", text: PROMPTS[kind] }] }],
    });
    await recordAiUsage({ branchId: ctx.branchId, userId: ctx.userId, feature: ctx.feature, model: COPILOT_MODEL, usage: res.usage });
    const text = res.content.find((b) => b.type === "text");
    if (res.stop_reason === "refusal" || text?.type !== "text") return { status: 422, error: "AI couldn't read this one." };
    const raw = JSON.parse(text.text) as Record<string, string>;
    const fields: Record<string, string> = {};
    for (const key of Object.keys(SCHEMAS[kind].properties)) {
      const v = String(raw[key] ?? "").trim().slice(0, 200);
      fields[key] = DATE_FIELDS.has(key) ? (ISO.test(v) ? v : "") : v;
    }
    return { status: 200, fields };
  } catch {
    return { status: 502, error: "AI couldn't read this one. You can fill it in by hand." };
  }
}
