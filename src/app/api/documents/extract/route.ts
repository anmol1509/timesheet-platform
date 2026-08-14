import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const GENERIC_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: ["string", "null"], description: "Full name as printed on the document" },
    passportNumber: { type: ["string", "null"] },
    emiratesId: { type: ["string", "null"], description: "15-digit UAE Emirates ID number" },
    dateOfBirth: { type: ["string", "null"], description: "ISO 8601 date, e.g. 1990-05-14" },
    nationality: { type: ["string", "null"] },
  },
  required: ["name", "passportNumber", "emiratesId", "dateOfBirth", "nationality"],
  additionalProperties: false,
};

const GENERIC_PROMPT =
  "This is an identity document (passport, Emirates ID, or visa page) for a construction-industry worker. Extract the full name, passport number, Emirates ID number, date of birth, and nationality exactly as printed. Use null for any field you cannot read with confidence — do not guess.";

const DOC_TYPE_CONFIG: Record<string, { schema: object; prompt: string }> = {
  PASSPORT: {
    schema: {
      type: "object" as const,
      properties: {
        name: { type: ["string", "null"], description: "Full name as printed on the passport" },
        dateOfBirth: { type: ["string", "null"], description: "ISO 8601 date, e.g. 1990-05-14" },
        nationality: { type: ["string", "null"] },
        passportNumber: { type: ["string", "null"] },
        passportExpiry: { type: ["string", "null"], description: "ISO 8601 date of expiry" },
      },
      required: ["name", "dateOfBirth", "nationality", "passportNumber", "passportExpiry"],
      additionalProperties: false,
    },
    prompt:
      "This is a passport's bio-data page for a construction-industry worker. Extract the full name, date of birth, nationality, passport number, and passport expiry date exactly as printed. Use null for any field you cannot read with confidence — do not guess.",
  },
  EMIRATES_ID: {
    schema: {
      type: "object" as const,
      properties: {
        name: { type: ["string", "null"], description: "Full name as printed on the Emirates ID" },
        dateOfBirth: { type: ["string", "null"], description: "ISO 8601 date, e.g. 1990-05-14" },
        nationality: { type: ["string", "null"] },
        emiratesId: { type: ["string", "null"], description: "15-digit UAE Emirates ID number" },
        emiratesIdExpiry: { type: ["string", "null"], description: "ISO 8601 date of expiry" },
      },
      required: ["name", "dateOfBirth", "nationality", "emiratesId", "emiratesIdExpiry"],
      additionalProperties: false,
    },
    prompt:
      "This is a UAE Emirates ID card for a construction-industry worker. Extract the full name, date of birth, nationality, the 15-digit Emirates ID number, and the card's expiry date exactly as printed. Use null for any field you cannot read with confidence — do not guess.",
  },
  LABOR_CARD: {
    schema: {
      type: "object" as const,
      properties: {
        name: { type: ["string", "null"], description: "Full name as printed on the labour card" },
        laborCardNumber: { type: ["string", "null"] },
        laborCardPersonalNo: { type: ["string", "null"], description: "MOHRE personal number" },
        laborCardExpiry: { type: ["string", "null"], description: "ISO 8601 date of expiry" },
      },
      required: ["name", "laborCardNumber", "laborCardPersonalNo", "laborCardExpiry"],
      additionalProperties: false,
    },
    prompt:
      "This is a UAE MOHRE labour card for a construction-industry worker. Extract the full name, labour card number, personal number, and expiry date exactly as printed. Use null for any field you cannot read with confidence — do not guess.",
  },
};

// A single upload is very often one PDF holding the passport page, the
// Emirates ID, the labour card and a photo together — which is how these
// packets actually arrive. This reads every document present in one pass
// rather than making the user split the file and upload it four times.
const COMBINED_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: ["string", "null"], description: "Full name, preferring the passport spelling" },
    dateOfBirth: { type: ["string", "null"], description: "ISO 8601 date, e.g. 1990-05-14" },
    nationality: { type: ["string", "null"] },
    gender: { type: ["string", "null"], description: "MALE or FEMALE" },
    passportNumber: { type: ["string", "null"] },
    passportExpiry: { type: ["string", "null"], description: "ISO 8601 date" },
    emiratesId: { type: ["string", "null"], description: "15-digit UAE Emirates ID, digits and hyphens as printed" },
    emiratesIdExpiry: { type: ["string", "null"], description: "ISO 8601 date" },
    laborCardNumber: { type: ["string", "null"], description: "MOHRE work permit number" },
    laborCardPersonalNo: { type: ["string", "null"], description: "MOHRE personal number" },
    laborCardExpiry: { type: ["string", "null"], description: "ISO 8601 date" },
    position: { type: ["string", "null"], description: "Profession or job title as printed" },
    documentsFound: {
      type: "array" as const,
      description: "Which document types were actually present",
      items: { type: "string" as const },
    },
  },
  required: [
    "name",
    "dateOfBirth",
    "nationality",
    "gender",
    "passportNumber",
    "passportExpiry",
    "emiratesId",
    "emiratesIdExpiry",
    "laborCardNumber",
    "laborCardPersonalNo",
    "laborCardExpiry",
    "position",
    "documentsFound",
  ],
  additionalProperties: false,
};

const COMBINED_PROMPT =
  "This file is a document pack for a construction-industry worker in the UAE. It may contain any combination of a passport bio-data page, an Emirates ID card, a MOHRE labour card / work permit, a visa page and a photograph, across one or more pages. Extract every field you can read across ALL pages. Dates must be ISO 8601 (YYYY-MM-DD) — convert formats like 19/Apr/2028 to 2028-04-19. Prefer the passport spelling of the name. In documentsFound, list the document types you actually saw, using PASSPORT, EMIRATES_ID, LABOR_CARD, VISA or PHOTO. Use null for anything you cannot read with confidence — never guess.";

export type ExtractedDocumentFields = {
  name?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
  emiratesId?: string | null;
  emiratesIdExpiry?: string | null;
  laborCardNumber?: string | null;
  laborCardPersonalNo?: string | null;
  laborCardExpiry?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  gender?: string | null;
  position?: string | null;
  documentsFound?: string[];
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Document auto-fill isn't configured yet — ANTHROPIC_API_KEY is missing." },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File too large — max ${MAX_UPLOAD_LABEL}.` },
      { status: 400 }
    );
  }

  const isImage = SUPPORTED_IMAGE_TYPES.has(file.type);
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) {
    return NextResponse.json(
      { error: "Only images (JPEG/PNG/GIF/WebP) or PDFs can be auto-read." },
      { status: 400 }
    );
  }

  const docType = String(formData.get("docType") || "");
  const config =
    docType === "COMBINED"
      ? { schema: COMBINED_SCHEMA, prompt: COMBINED_PROMPT }
      : (DOC_TYPE_CONFIG[docType] ?? { schema: GENERIC_SCHEMA, prompt: GENERIC_PROMPT });

  const bytes = Buffer.from(await file.arrayBuffer());
  const data = bytes.toString("base64");

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: config.schema as Record<string, unknown> } },
      messages: [
        {
          role: "user",
          content: [
            isImage
              ? { type: "image", source: { type: "base64", media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data } }
              : { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
            {
              type: "text",
              text: config.prompt,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Extraction was declined." }, { status: 422 });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No extraction result returned." }, { status: 502 });
    }

    const parsed = JSON.parse(textBlock.text) as ExtractedDocumentFields;
    return NextResponse.json(parsed);
  } catch (e) {
    // Map provider failures onto something a user can act on, and keep the raw
    // SDK message in the server log rather than putting it on screen.
    console.error("Document extraction failed:", e);
    const status =
      typeof e === "object" && e !== null && "status" in e
        ? Number((e as { status: unknown }).status)
        : 0;

    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: "Document auto-fill is misconfigured — the API key was rejected." },
        { status: 502 }
      );
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "Auto-fill is rate limited right now — try again in a moment." },
        { status: 502 }
      );
    }
    if (status === 413) {
      return NextResponse.json(
        { error: "That document is too large to read. Try a smaller or split file." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Couldn't read this document. Enter the details manually." },
      { status: 502 }
    );
  }
}
