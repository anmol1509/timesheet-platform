import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser, isBlockedByPermissions } from "@/lib/auth";
import { EXTRACTION_LIMIT, rateLimit } from "@/lib/rateLimit";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, DOCUMENT_MODEL } from "@/lib/constants";
import { EXPENSE_CATEGORIES } from "@/lib/financeConstants";

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const SCHEMA = {
  type: "object" as const,
  properties: {
    vendor: { type: "string" as const, description: "Business/merchant name as printed at the top of the receipt" },
    date: { type: "string" as const, description: "ISO 8601 date (YYYY-MM-DD) the receipt was issued" },
    amount: { type: "string" as const, description: "The pre-VAT subtotal, digits only (e.g. '245.00'). If the receipt only shows one total with no separate VAT line, put that full total here and leave vatAmount empty." },
    vatAmount: { type: "string" as const, description: "VAT/tax amount, digits only, only if printed as its own line separate from the total — empty string otherwise" },
    category: {
      type: "string" as const,
      enum: [...EXPENSE_CATEGORIES, ""],
      description: "Best-fit category from the fixed list based on what was purchased — empty string if none fits confidently",
    },
    reference: { type: "string" as const, description: "Receipt/invoice/transaction number as printed" },
    description: { type: "string" as const, description: "Short (under 8 words) description of what was purchased, e.g. 'Diesel refuel' or 'Site catering — lunch'" },
  },
  required: ["vendor", "date", "amount", "vatAmount", "category", "reference", "description"],
  additionalProperties: false,
};

const PROMPT =
  "This is a photo or scan of a business expense receipt or invoice. Extract the merchant/vendor name, the date of the transaction, the pre-VAT amount, any VAT/tax shown as a separate line, the best-fit expense category from the given list, the receipt/invoice reference number, and a short description of the purchase. Dates must be ISO 8601 (YYYY-MM-DD). Amounts are digits only, no currency symbol or thousands separators. Return an empty string for anything you cannot read with confidence — do not guess, and never invent a vendor name, amount or date that isn't actually printed.";

export type ExtractedReceiptFields = {
  vendor?: string;
  date?: string;
  amount?: string;
  vatAmount?: string;
  category?: string;
  reference?: string;
  description?: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (await isBlockedByPermissions(user))) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const budget = rateLimit(`extract-receipt:${user.id}`, EXTRACTION_LIMIT);
  if (!budget.allowed) {
    return NextResponse.json(
      { error: "Too many receipts read in the last hour — try again shortly." },
      { status: 429, headers: { "Retry-After": String(budget.retryAfter) } }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Receipt auto-fill isn't configured yet — ANTHROPIC_API_KEY is missing." },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `File too large — max ${MAX_UPLOAD_LABEL}.` }, { status: 400 });
  }

  const isImage = SUPPORTED_IMAGE_TYPES.has(file.type);
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) {
    return NextResponse.json({ error: "Only images (JPEG/PNG/GIF/WebP) or PDFs can be auto-read." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const data = bytes.toString("base64");
  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: DOCUMENT_MODEL,
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
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

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Extraction was declined." }, { status: 422 });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No extraction result returned." }, { status: 502 });
    }

    const parsed = JSON.parse(textBlock.text) as ExtractedReceiptFields;
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Receipt extraction failed:", e);
    const status = typeof e === "object" && e !== null && "status" in e ? Number((e as { status: unknown }).status) : 0;

    if (status === 401 || status === 403) {
      return NextResponse.json({ error: "Receipt auto-fill is misconfigured — the API key was rejected." }, { status: 502 });
    }
    if (status === 429) {
      return NextResponse.json({ error: "Auto-fill is rate limited right now — try again in a moment." }, { status: 502 });
    }
    if (status === 413) {
      return NextResponse.json({ error: "That receipt is too large to read. Try a smaller or split file." }, { status: 502 });
    }
    return NextResponse.json({ error: "Couldn't read this receipt. Enter the details manually." }, { status: 502 });
  }
}
