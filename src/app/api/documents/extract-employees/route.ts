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

const EXTRACT_EMPLOYEES_SCHEMA = {
  type: "object" as const,
  properties: {
    employees: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: ["string", "null"], description: "Employee full name as printed" },
          category: { type: ["string", "null"], description: "Broad job category column, e.g. 'Manual Labourers'" },
          designation: { type: ["string", "null"], description: "Specific trade/designation, e.g. 'Carpenter', 'Steel Fixer'" },
          salary: { type: ["string", "null"], description: "Named/listed salary amount as printed, digits only if possible" },
        },
        required: ["name", "category", "designation", "salary"],
        additionalProperties: false,
      },
    },
  },
  required: ["employees"],
  additionalProperties: false,
};

export type ExtractedEmployeeRow = {
  name: string | null;
  category: string | null;
  designation: string | null;
  salary: string | null;
};

export type ExtractedEmployeesResult = {
  employees: ExtractedEmployeeRow[];
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

  const bytes = Buffer.from(await file.arrayBuffer());
  const data = bytes.toString("base64");

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 8192,
      output_config: { format: { type: "json_schema", schema: EXTRACT_EMPLOYEES_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            isImage
              ? { type: "image", source: { type: "base64", media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data } }
              : { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
            {
              type: "text",
              text: "This is a workmen's compensation / labour insurance certificate for a construction-industry manpower supplier. It contains a schedule/table of insured employees, typically with columns like Sr.No, Employee Name, Category, Designation, and Salary, and the table may span multiple pages. Extract every employee row you can find across the whole document into the `employees` array, in the order they appear. For each row, extract the full name, the broad category column if present (e.g. 'Manual Labourers'), the specific designation/trade (e.g. 'Carpenter', 'Steel Fixer', 'Electrician'), and the salary amount as printed. Use null for any field you cannot read with confidence — do not guess, and do not invent rows that aren't in the table.",
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

    const parsed = JSON.parse(textBlock.text) as ExtractedEmployeesResult;
    return NextResponse.json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
