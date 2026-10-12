import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser, isBlockedByPermissions } from "@/lib/auth";
import { EXTRACTION_LIMIT, rateLimit } from "@/lib/rateLimit";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, DOCUMENT_MODEL } from "@/lib/constants";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

// Plain strings only (see the note in ../extract/route.ts about union-typed
// fields); "" means "not on this document".
const SCHEMA = {
  type: "object" as const,
  properties: {
    docType: {
      type: "string" as const,
      description: "TRADE_LICENSE, MOHRE_PERMIT, ESTABLISHMENT_CARD, TRN_CERTIFICATE, WORKMEN_COMPENSATION_INSURANCE, EJARI_TENANCY, CHAMBER_OF_COMMERCE or OTHER",
    },
    companyName: { type: "string" as const, description: "Company / establishment name in English, as printed" },
    tradeLicenseNumber: { type: "string" as const },
    tradeLicenseExpiry: { type: "string" as const, description: "Licence expiry, ISO 8601" },
    issueDate: { type: "string" as const, description: "Licence issue or registration date, ISO 8601" },
    trn: { type: "string" as const, description: "15-digit UAE tax registration number" },
    mohrePermitNumber: { type: "string" as const },
    documentExpiry: { type: "string" as const, description: "Expiry date of THIS document, ISO 8601" },
    emirate: { type: "string" as const, description: "Emirate of the registered address, e.g. Dubai" },
    phone: { type: "string" as const },
    email: { type: "string" as const },
  },
  required: ["docType", "companyName", "tradeLicenseNumber", "tradeLicenseExpiry", "issueDate", "trn", "mohrePermitNumber", "documentExpiry", "emirate", "phone", "email"],
  additionalProperties: false,
};

const PROMPT =
  "This is a business document of a UAE company: a trade licence, MOHRE permit or establishment card, tax (TRN) certificate, insurance, tenancy or chamber of commerce certificate. First say which it is (docType). Then extract only what is printed: company name in English, trade licence number and expiry, issue date, 15-digit TRN, MOHRE permit number, the expiry date of this document, emirate, phone and email. Dates must be ISO 8601 (YYYY-MM-DD): convert formats like 19/Apr/2028 to 2028-04-19. Return an empty string for anything you cannot read with confidence — do not guess.";

export type ExtractedCompanyFields = {
  docType?: string; companyName?: string; tradeLicenseNumber?: string; tradeLicenseExpiry?: string; issueDate?: string; trn?: string;
  mohrePermitNumber?: string; documentExpiry?: string; emirate?: string; phone?: string; email?: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (await isBlockedByPermissions(user))) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const budget = rateLimit(`extract:${user.id}`, EXTRACTION_LIMIT);
  if (!budget.allowed) return NextResponse.json({ error: "Too many documents read in the last hour — try again shortly." }, { status: 429, headers: { "Retry-After": String(budget.retryAfter) } });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Document auto-fill isn't configured yet — ANTHROPIC_API_KEY is missing." }, { status: 503 });

  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: `File too large — max ${MAX_UPLOAD_LABEL}.` }, { status: 400 });
  const isImage = IMAGE_TYPES.has(file.type);
  if (!isImage && file.type !== "application/pdf") return NextResponse.json({ error: "Only images (JPEG/PNG/GIF/WebP) or PDFs can be auto-read." }, { status: 400 });

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const response = await new Anthropic().messages.create({
      model: DOCUMENT_MODEL,
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: SCHEMA as Record<string, unknown> } },
      messages: [
        {
          role: "user",
          content: [
            isImage
              ? { type: "image", source: { type: "base64", media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data } }
              : { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return NextResponse.json({ error: "Extraction was declined." }, { status: 422 });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return NextResponse.json({ error: "No extraction result returned." }, { status: 502 });
    return NextResponse.json(JSON.parse(block.text) as ExtractedCompanyFields);
  } catch (e) {
    console.error("Company document extraction failed:", e);
    return NextResponse.json({ error: "Couldn't read this document. Enter the details manually." }, { status: 502 });
  }
}
