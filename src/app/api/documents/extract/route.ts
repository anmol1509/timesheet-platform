import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser, isBlockedByPermissions } from "@/lib/auth";
import { EXTRACTION_LIMIT, rateLimit } from "@/lib/rateLimit";
import { aiBranchOf, aiGate, recordAiUsage } from "@/lib/aiCreditsServer";
import { reconcilePassport, type PassportCheck } from "@/lib/passportMrz";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, DOCUMENT_MODEL, thinkingOff } from "@/lib/constants";

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
        passportExpiry: { type: "string" as const, description: "ISO 8601 date from the field labelled Date of expiry / Date d'expiration — NOT the date of issue" },
        passportIssueDate: { type: "string" as const, description: "ISO 8601 date from the field labelled Date of issue / Date de délivrance" },
        mrzLine2: { type: "string" as const, description: "The second (bottom) line of the machine-readable zone, copied character by character, 44 characters" },
      },
      required: ["name", "dateOfBirth", "nationality", "passportNumber", "passportExpiry", "passportIssueDate", "mrzLine2"],
      additionalProperties: false,
    },
    prompt:
      "This is a passport's bio-data page for a construction-industry worker. Extract the full name, date of birth, nationality, passport number, issue date and expiry date exactly as printed. Issue and expiry sit next to each other under their labels and are ten years apart on most passports (five on some): the expiry date is the LATER one, so check which label each date is under. Also copy the second line of the machine-readable zone at the bottom exactly (it repeats the passport number, birth date and expiry date). Return an empty string for any field you cannot read with confidence — do not guess.",
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
  VISA: {
    schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Full name as printed" },
        visaNumber: { type: "string" as const, description: "Visa / residency file number, e.g. 301/2026/2/82612" },
        visaExpiry: { type: "string" as const, description: "Visa expiry as ISO 8601 (YYYY-MM-DD)" },
      },
      required: ["name", "visaNumber", "visaExpiry"],
      additionalProperties: false,
    },
    prompt:
      "This is a residence visa, entry permit or residency page for a construction-industry worker in the UAE. Extract the holder's name, the visa or residency file number and the visa expiry date. Use an empty string for anything the document does not print. Never work an expiry out by adding a period to an issue date.",
  },
  MEDICAL: {
    schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Full name as printed" },
        medicalExpiry: { type: "string" as const, description: "Date the certificate stops being valid as ISO 8601 (YYYY-MM-DD), only if printed" },
      },
      required: ["name", "medicalExpiry"],
      additionalProperties: false,
    },
    prompt:
      "This is a medical fitness certificate for a construction-industry worker in the UAE. Extract the holder's name and the date the certificate is valid until. Use an empty string for anything the document does not print. Never work an expiry out by adding a period to an issue date.",
  },
  CICPA: {
    schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Full name as printed" },
        cicpaExpiry: { type: "string" as const, description: "Clearance expiry as ISO 8601 (YYYY-MM-DD), only if printed" },
      },
      required: ["name", "cicpaExpiry"],
      additionalProperties: false,
    },
    prompt:
      "This is a CICPA (Abu Dhabi critical infrastructure) clearance for a construction-industry worker in the UAE. Extract the holder's name and the clearance expiry date. Use an empty string for anything the document does not print. Never work an expiry out by adding a period to an issue date.",
  },
  INSURANCE: {
    schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Full name of the insured person as printed" },
        insuranceExpiry: { type: "string" as const, description: "Policy or card expiry as ISO 8601 (YYYY-MM-DD), only if printed" },
      },
      required: ["name", "insuranceExpiry"],
      additionalProperties: false,
    },
    prompt:
      "This is a health insurance card or policy certificate for a construction-industry worker in the UAE. Extract the insured person's name and the expiry date of the cover. Use an empty string for anything the document does not print. Never work an expiry out by adding a period to an issue date.",
  },
  DRIVING_LICENCE: {
    schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Full name as printed" },
        drivingLicenceNumber: { type: "string" as const, description: "Licence number as printed" },
        drivingLicenceExpiry: { type: "string" as const, description: "Licence expiry as ISO 8601 (YYYY-MM-DD)" },
      },
      required: ["name", "drivingLicenceNumber", "drivingLicenceExpiry"],
      additionalProperties: false,
    },
    prompt:
      "This is a driving licence for a construction-industry worker in the UAE. Extract the holder's name, the licence number and the expiry date. Use an empty string for anything the document does not print. Never work an expiry out by adding a period to an issue date.",
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
        unifiedNo: { type: "string" as const, description: "The number printed next to the label UNIFIED NO on this form; empty if it is not printed" },
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
    passportExpiry: { type: "string" as const, description: "ISO 8601 date from the field labelled Date of expiry on the passport — NOT the date of issue" },
    passportIssueDate: { type: "string" as const, description: "ISO 8601 date from the field labelled Date of issue on the passport; empty if no passport" },
    mrzLine2: { type: "string" as const, description: "Second (bottom) line of the passport machine-readable zone, copied exactly; empty if none" },
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
    unifiedNo: { type: "string" as const, description: "The number printed next to the label UNIFIED NO / U.I.D. on a visa page or an ICP residency / registration form. NEVER the number under the chip of an Emirates ID card (that is the card number). Empty if no such label is printed." },
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
    "passportIssueDate",
    "mrzLine2",
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
  "This file is a document pack for a construction-industry worker in the UAE. It may contain any combination of a passport bio-data page, an Emirates ID card, a MOHRE labour card / work permit, a visa page, an ICP 'Residency and Identity Issuance' notice and a photograph, across one or more pages. Extract every field you can read across ALL pages. Dates must be ISO 8601 (YYYY-MM-DD) — convert formats like 19/Apr/2028 to 2028-04-19. Prefer the passport spelling of the name. On a passport, the issue and expiry dates sit side by side under their labels; the expiry date is the later one (usually ten years after issue), so check which label each date is under, and copy the bottom machine-readable line into mrzLine2. In documentsFound, list only the document types you actually saw, using PASSPORT, EMIRATES_ID, LABOR_CARD, VISA, RESIDENCY_ISSUANCE or PHOTO. Be strict about LABOR_CARD: it is a separate MOHRE work permit document carrying its own work permit number. The reverse of an Emirates ID card also prints an occupation and employer — that is still EMIRATES_ID, not a labour card. Only report LABOR_CARD when you can actually read a work permit number on a MOHRE document. Copy names and employer names in full, including trailing words like CONT, CONTRACTING, LLC or TECH, and preserve the exact capitalisation printed. An ICP 'Registration ID Card Form' (Emirates ID application receipt) is issued before the Emirates ID card exists, so a pack normally holds one or the other: report RESIDENCY_ISSUANCE for it, take its IDENTITY NUMBER as visaNumber, and only set emiratesId when a 15-digit identity number is actually printed somewhere. In photoPage, give the 1-based page number of any page that is mostly a portrait headshot of the worker, so it can be used as their profile picture; leave it empty if no page is a standalone photograph. The Unified number (UID) is only the number printed beside a UNIFIED NO / U.I.D. label on a visa page or an ICP form. The number printed below the chip on the front of an Emirates ID card is the card number, not the UID: leave unifiedNo empty unless a UNIFIED NO / U.I.D. label is printed. Return an empty string for anything you cannot read with confidence — never guess.";

export type ExtractedDocumentFields = {
  name?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
  passportIssueDate?: string | null;
  mrzLine2?: string | null;
  /** Passports: which values the machine-readable lines confirmed. Absent when no passport was read. */
  passportCheck?: PassportCheck;
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
  medicalExpiry?: string | null;
  cicpaExpiry?: string | null;
  insuranceExpiry?: string | null;
  drivingLicenceExpiry?: string | null;
  drivingLicenceNumber?: string | null;
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
  parsed: ExtractedDocumentFields,
  docType?: string
): ExtractedDocumentFields {
  // The Unified number is printed on a visa page or an ICP form. An Emirates ID card only has a card number under
  // the chip, which is easy to mistake for it, so a UID is kept only when one of those documents was read.
  const printsUid = docType === "VISA" || docType === "RESIDENCY_ISSUANCE" || !!parsed.documentsFound?.some((t) => t === "VISA" || t === "RESIDENCY_ISSUANCE");
  if (parsed.unifiedNo && !printsUid) parsed = { ...parsed, unifiedNo: "" };
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
  if (!user || (await isBlockedByPermissions(user))) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const branchId = await aiBranchOf(user);
  const gate = await aiGate(branchId);
  if (gate) return NextResponse.json({ error: gate }, { status: 402 });
  const budget = rateLimit(`extract:${user.id}`, EXTRACTION_LIMIT);
  if (!budget.allowed) {
    return NextResponse.json(
      { error: "Too many documents read in the last hour. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(budget.retryAfter) } }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Document auto-fill isn't set up yet: the AI key is missing." },
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
      { error: `File too large, max ${MAX_UPLOAD_LABEL}.` },
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
      ...thinkingOff(DOCUMENT_MODEL),
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

    await recordAiUsage({ branchId, userId: user.id, feature: "document-extract", model: DOCUMENT_MODEL, usage: response.usage });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Extraction was declined." }, { status: 422 });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No extraction result returned." }, { status: 502 });
    }

    const parsed = JSON.parse(textBlock.text) as ExtractedDocumentFields;
    const settled = parsed.passportNumber || parsed.passportExpiry || parsed.mrzLine2 ? reconcilePassport(parsed) : parsed;
    return NextResponse.json(withConsistentDocumentsFound(settled, docType));
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
        { error: "Document auto-fill isn't set up correctly: the AI key was rejected." },
        { status: 502 }
      );
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "Auto-fill is rate limited right now. Try again in a moment." },
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
