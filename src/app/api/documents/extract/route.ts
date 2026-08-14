import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, DOCUMENT_MODEL } from "@/lib/constants";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

// Every field below is a plain `string`, never `["string", "null"]`, and the
// prompts ask for "" when a value can't be read. Structured output rejects a
// schema with more than 16 union-typed parameters ("exponential compilation
// cost"), and the combined schema quietly crossed that line at 18 fields —
// which failed the whole extraction with a 400. Empty strings cost one union
// each of zero, so the schema can keep growing. Callers already treat "" and
// null alike, since both are falsy.

const GENERIC_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const, description: "Full name as printed on the document" },
    passportNumber: { type: "string" as const },
    emiratesId: { type: "string" as const, description: "15-digit UAE Emirates ID number" },
    dateOfBirth: { type: "string" as const, description: "ISO 8601 date, e.g. 1990-05-14" },
    nationality: { type: "string" as const },
  },
  required: ["name", "passportNumber", "emiratesId", "dateOfBirth", "nationality"],
  additionalProperties: false,
};

const GENERIC_PROMPT =
  "This is an identity document (passport, Emirates ID, or visa page) for a construction-industry worker. Extract the full name, passport number, Emirates ID number, date of birth, and nationality exactly as printed. Return an empty string for any field you cannot read with confidence — do not guess.";

const DOC_TYPE_CONFIG: Record<string, { schema: object; prompt: string }> = {
  PASSPORT: {
    schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Full name as printed on the passport" },
        dateOfBirth: { type: "string" as const, description: "ISO 8601 date, e.g. 1990-05-14" },
        nationality: { type: "string" as const },
        passportNumber: { type: "string" as const },
        passportExpiry: { type: "string" as const, description: "ISO 8601 date of expiry" },
      },
      required: ["name", "dateOfBirth", "nationality", "passportNumber", "passportExpiry"],
      additionalProperties: false,
    },
    prompt:
      "This is a passport's bio-data page for a construction-industry worker. Extract the full name, date of birth, nationality, passport number, and passport expiry date exactly as printed. Return an empty string for any field you cannot read with confidence — do not guess.",
  },
  EMIRATES_ID: {
    schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Full name as printed on the Emirates ID" },
        dateOfBirth: { type: "string" as const, description: "ISO 8601 date, e.g. 1990-05-14" },
        nationality: { type: "string" as const },
        emiratesId: { type: "string" as const, description: "15-digit UAE Emirates ID number" },
        emiratesIdExpiry: { type: "string" as const, description: "ISO 8601 date of expiry" },
      },
      required: ["name", "dateOfBirth", "nationality", "emiratesId", "emiratesIdExpiry"],
      additionalProperties: false,
    },
    prompt:
      "This is a UAE Emirates ID card for a construction-industry worker. Extract the full name, date of birth, nationality, the 15-digit Emirates ID number, and the card's expiry date exactly as printed. Return an empty string for any field you cannot read with confidence — do not guess.",
  },
  LABOR_CARD: {
    schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Full name as printed on the labour card" },
        laborCardNumber: { type: "string" as const },
        laborCardPersonalNo: { type: "string" as const, description: "MOHRE personal number" },
        laborCardExpiry: { type: "string" as const, description: "ISO 8601 date of expiry" },
        position: { type: "string" as const, description: "Profession as printed" },
        nationality: { type: "string" as const },
        establishment: {
          type: "string" as const,
          description: "Employer/establishment name in English",
        },
      },
      required: [
        "name",
        "laborCardNumber",
        "laborCardPersonalNo",
        "laborCardExpiry",
        "position",
        "nationality",
        "establishment",
      ],
      additionalProperties: false,
    },
    prompt:
      "This is a UAE MOHRE labour card for a construction-industry worker. Extract the full name, the work permit number (labour card number), the personal number, the expiry date, the profession, the nationality, and the establishment/employer name — all in English, exactly as printed. Dates must be ISO 8601 (YYYY-MM-DD): convert formats like 19/Apr/2028 to 2028-04-19. Return an empty string for any field you cannot read with confidence — do not guess.",
  },
  // The ICP "Registration ID Card Form" is the receipt for an Emirates ID
  // application — printed when residency is issued, before the card itself
  // exists. A worker has either this or the card, so it must be readable in
  // its own right. It carries no Emirates ID number and no expiry date; what
  // it does carry is the residency file number and the unified number.
  RESIDENCY_ISSUANCE: {
    schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "NAME, in English" },
        dateOfBirth: { type: "string" as const, description: "DATE OF BIRTH as ISO 8601" },
        nationality: { type: "string" as const, description: "NATIONALITY, in English" },
        gender: { type: "string" as const, description: "MALE or FEMALE" },
        mobileNumber: { type: "string" as const, description: "PHONE NO. as printed" },
        emiratesId: {
          type: "string" as const,
          description:
            "Only if a 15-digit Emirates ID number is actually printed; this form usually has none, so expect an empty string",
        },
        visaNumber: {
          type: "string" as const,
          description: "IDENTITY NUMBER — the residency file number, e.g. 301/2026/2/82612",
        },
        unifiedNo: { type: "string" as const, description: "UNIFIED NO" },
        establishment: {
          type: "string" as const,
          description: "Establishment under 'Submitted By', in English",
        },
      },
      required: [
        "name",
        "dateOfBirth",
        "nationality",
        "gender",
        "mobileNumber",
        "emiratesId",
        "visaNumber",
        "unifiedNo",
        "establishment",
      ],
      additionalProperties: false,
    },
    prompt:
      "This is a UAE ICP 'Registration ID Card Form' — the Emirates ID application receipt issued to a construction-industry worker once residency is granted, before the physical card is printed. Read the printed labels: NAME, DATE OF BIRTH, NATIONALITY, GENDER, PHONE NO., IDENTITY NUMBER (a residency file number such as 301/2026/2/82612 — return it in visaNumber), UNIFIED NO, and the establishment shown under 'Submitted By' — copy that employer name in full, including trailing words like CONT, CONTRACTING or LLC, exactly as printed. Dates must be ISO 8601 (YYYY-MM-DD): convert 28/06/1985 to 1985-06-28. This form does not print a 15-digit Emirates ID number, a passport number or a card expiry date — return an empty string for emiratesId unless such a number genuinely appears. Return an empty string for anything you cannot read with confidence — do not guess.",
  },
};

// A single upload is very often one PDF holding the passport page, the
// Emirates ID, the labour card and a photo together — which is how these
// packets actually arrive. This reads every document present in one pass
// rather than making the user split the file and upload it four times.
const COMBINED_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const, description: "Full name, preferring the passport spelling" },
    dateOfBirth: { type: "string" as const, description: "ISO 8601 date, e.g. 1990-05-14" },
    nationality: { type: "string" as const },
    gender: { type: "string" as const, description: "MALE or FEMALE" },
    passportNumber: { type: "string" as const },
    passportExpiry: { type: "string" as const, description: "ISO 8601 date" },
    emiratesId: { type: "string" as const, description: "15-digit UAE Emirates ID, digits and hyphens as printed" },
    emiratesIdExpiry: { type: "string" as const, description: "ISO 8601 date" },
    laborCardNumber: { type: "string" as const, description: "MOHRE work permit number" },
    laborCardPersonalNo: { type: "string" as const, description: "MOHRE personal number" },
    laborCardExpiry: { type: "string" as const, description: "ISO 8601 date" },
    position: { type: "string" as const, description: "Profession or job title as printed" },
    establishment: {
      type: "string" as const,
      description: "Employer/establishment name on the labour card, in English",
    },
    visaNumber: {
      type: "string" as const,
      description:
        "Residence file number — the visa's file number, or IDENTITY NUMBER on an ICP registration form",
    },
    visaExpiry: { type: "string" as const, description: "ISO 8601 residency/visa expiry date" },
    sponsorName: {
      type: "string" as const,
      description: "Sponsor named on the visa or residency issuance page, in English",
    },
    unifiedNo: { type: "string" as const, description: "UNIFIED NO / U.I.D." },
    mobileNumber: { type: "string" as const, description: "Phone number as printed" },
    photoPage: {
      type: "string" as const,
      description:
        "1-based page number of a page that is mostly a portrait photograph of the worker (a passport-style headshot on its own page). Empty if no such page exists.",
    },
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
    "establishment",
    "visaNumber",
    "visaExpiry",
    "sponsorName",
    "unifiedNo",
    "mobileNumber",
    "photoPage",
    "documentsFound",
  ],
  additionalProperties: false,
};

const COMBINED_PROMPT =
  "This file is a document pack for a construction-industry worker in the UAE. It may contain any combination of a passport bio-data page, an Emirates ID card, a MOHRE labour card / work permit, a visa page, an ICP 'Residency and Identity Issuance' notice and a photograph, across one or more pages. Extract every field you can read across ALL pages. Dates must be ISO 8601 (YYYY-MM-DD) — convert formats like 19/Apr/2028 to 2028-04-19. Prefer the passport spelling of the name. In documentsFound, list only the document types you actually saw, using PASSPORT, EMIRATES_ID, LABOR_CARD, VISA, RESIDENCY_ISSUANCE or PHOTO. Be strict about LABOR_CARD: it is a separate MOHRE work permit document carrying its own work permit number. The reverse of an Emirates ID card also prints an occupation and employer — that is still EMIRATES_ID, not a labour card. Only report LABOR_CARD when you can actually read a work permit number on a MOHRE document. Copy names and employer names in full, including trailing words like CONT, CONTRACTING, LLC or TECH, and preserve the exact capitalisation printed. An ICP 'Registration ID Card Form' (Emirates ID application receipt) is issued before the Emirates ID card exists, so a pack normally holds one or the other: report RESIDENCY_ISSUANCE for it, take its IDENTITY NUMBER as visaNumber, and only set emiratesId when a 15-digit identity number is actually printed somewhere. In photoPage, give the 1-based page number of any page that is mostly a portrait headshot of the worker, so it can be used as their profile picture; leave it empty if no page is a standalone photograph. Return an empty string for anything you cannot read with confidence — never guess.";

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
  /** Employer printed on the labour card — used to suggest a matching Supplier. */
  establishment?: string | null;
  photoPage?: string | null;
  visaNumber?: string | null;
  visaExpiry?: string | null;
  sponsorName?: string | null;
  unifiedNo?: string | null;
  mobileNumber?: string | null;
  documentsFound?: string[];
};

/**
 * Drops a claimed document type when the number that defines it wasn't read.
 *
 * The checklist exists to show what's *missing*, so a false "found" is worse
 * than a false "missing" — it tells the user to stop looking for a document
 * they still need. The back of an Emirates ID prints an occupation and
 * employer and reads a lot like a labour card, which is exactly the confusion
 * this catches, whichever model is behind DOCUMENT_MODEL.
 */
function withConsistentDocumentsFound(
  parsed: ExtractedDocumentFields
): ExtractedDocumentFields {
  if (!parsed.documentsFound?.length) return parsed;

  const evidence: Record<string, string | null | undefined> = {
    LABOR_CARD: parsed.laborCardNumber || parsed.laborCardPersonalNo,
    PASSPORT: parsed.passportNumber,
    EMIRATES_ID: parsed.emiratesId,
    RESIDENCY_ISSUANCE: parsed.visaNumber || parsed.unifiedNo,
  };

  return {
    ...parsed,
    documentsFound: parsed.documentsFound.filter((type) =>
      type in evidence ? !!evidence[type] : true
    ),
  };
}

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
      model: DOCUMENT_MODEL,
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
    return NextResponse.json(withConsistentDocumentsFound(parsed));
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
