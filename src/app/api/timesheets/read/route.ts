import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser, isBlockedByPermissions } from "@/lib/auth";
import { EXTRACTION_LIMIT, rateLimit } from "@/lib/rateLimit";
import { aiBranchOf, aiGate, recordAiUsage } from "@/lib/aiCreditsServer";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, DOCUMENT_MODEL, thinkingOff } from "@/lib/constants";
import { cleanTimesheetRows } from "@/lib/timesheetRead";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const SCHEMA = {
  type: "object" as const,
  properties: {
    rows: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          employeeIdNo: { type: "string" as const, description: "The worker's ID / code exactly as printed, or an empty string" },
          employeeName: { type: "string" as const, description: "The worker's name exactly as printed" },
          trade: { type: "string" as const, description: "Trade or designation if the sheet prints one, else an empty string" },
          days: { type: "array" as const, items: { type: "string" as const }, description: "One entry per calendar day of the month in order, day 1 first. The hours worked as a number, A for absent, OFF for a day off, or an empty string when the cell is blank or unreadable" },
        },
        required: ["employeeIdNo", "employeeName", "trade", "days"],
        additionalProperties: false,
      },
    },
  },
  required: ["rows"],
  additionalProperties: false,
};

function prompt(month: string, dayCount: number) {
  return `This is a monthly attendance / timesheet for construction workers, for ${month} (${dayCount} days). It has one row per worker and one column per day of the month. Read every worker's row. For each, give the worker's ID or code and name exactly as printed, and a "days" list of exactly ${dayCount} entries in calendar order (day 1 first): the hours written for that day as a number, "A" if marked absent, "OFF" if marked as a day off, holiday or leave, and an empty string when the cell is blank or you cannot read it. Do not guess a hour value you cannot read, and never invent a worker. Skip total rows and header rows.`;
}

/** Reads a scanned monthly timesheet into rows the bulk entry grid can take. Nothing is saved here. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (await isBlockedByPermissions(user))) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const branchId = await aiBranchOf(user);
  const gate = await aiGate(branchId);
  if (gate) return NextResponse.json({ error: gate }, { status: 402 });
  const budget = rateLimit(`timesheet-read:${user.id}`, EXTRACTION_LIMIT);
  if (!budget.allowed) return NextResponse.json({ error: "Too many files read in the last hour. Try again shortly." }, { status: 429, headers: { "Retry-After": String(budget.retryAfter) } });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Reading a scan isn't set up yet: the AI key is missing." }, { status: 503 });

  const form = await request.formData();
  const file = form.get("file");
  const month = String(form.get("month") || "");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Choose the month first." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: `File too large, max ${MAX_UPLOAD_LABEL}.` }, { status: 400 });
  const isImage = IMAGE_TYPES.has(file.type);
  if (!isImage && file.type !== "application/pdf") return NextResponse.json({ error: "Only images (JPEG/PNG/GIF/WebP) or PDFs can be read." }, { status: 400 });

  const [y, m] = month.split("-").map(Number);
  const dayCount = new Date(y, m, 0).getDate();
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: DOCUMENT_MODEL,
      ...thinkingOff(DOCUMENT_MODEL),
      max_tokens: 16000,
      output_config: { format: { type: "json_schema", schema: SCHEMA as Record<string, unknown> } },
      messages: [{
        role: "user",
        content: [
          isImage
            ? { type: "image", source: { type: "base64", media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data } }
            : { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
          { type: "text", text: prompt(month, dayCount) },
        ],
      }],
    });
    await recordAiUsage({ branchId, userId: user.id, feature: "timesheet-read", model: DOCUMENT_MODEL, usage: response.usage });
    if (response.stop_reason === "refusal") return NextResponse.json({ error: "Reading was declined." }, { status: 422 });
    if (response.stop_reason === "max_tokens") return NextResponse.json({ error: "That sheet is too big to read in one go. Split it into smaller files." }, { status: 422 });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return NextResponse.json({ error: "Nothing was read from that file." }, { status: 502 });
    const rows = cleanTimesheetRows((JSON.parse(block.text) as { rows?: unknown }).rows, dayCount);
    return NextResponse.json({ rows });
  } catch (e) {
    console.error("Timesheet read failed:", e);
    const status = typeof e === "object" && e !== null && "status" in e ? Number((e as { status: unknown }).status) : 0;
    if (status === 401 || status === 403) return NextResponse.json({ error: "Reading a scan isn't set up correctly: the AI key was rejected." }, { status: 503 });
    if (status === 429) return NextResponse.json({ error: "The reader is busy. Try again in a minute." }, { status: 429 });
    return NextResponse.json({ error: "That file couldn't be read. Try a clearer photo or scan." }, { status: 502 });
  }
}
