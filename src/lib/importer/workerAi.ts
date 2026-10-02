import Anthropic from "@anthropic-ai/sdk";
import { COPILOT_MODEL } from "@/lib/constants";
import type { PlacementIssue } from "./types";

/**
 * Helps with worker names in a camp file that couldn't be matched exactly.
 * The model is only shown the typed name and a short list of workers already on
 * record who look similar (name, code, trade, supplier) — no documents, pay or
 * contact details — and may only pick from that list. Anything else it says is
 * ignored, and the person still confirms every choice on the review screen.
 */
const SCHEMA = {
  type: "object" as const,
  properties: {
    picks: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          key: { type: "string" as const },
          employeeId: { type: ["string", "null"] as unknown as "string", description: "The id of the worker the typed name most likely means, or null if none of them clearly does." },
          confidence: { type: "string" as const, enum: ["high", "medium", "low"] },
          reason: { type: "string" as const, description: "One short plain sentence, e.g. 'Same name; Mohd is short for Mohammed.'" },
        },
        required: ["key", "employeeId", "confidence", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["picks"],
  additionalProperties: false,
};

const SYSTEM = `You match worker names typed in a spreadsheet to workers already on record in a UAE manpower company.
For each typed name you get a short list of candidates. Pick the candidate the typed name most likely means, or null if none clearly does.
Names in this industry often have spelling variants (Mohd / Mohammed / Muhammad, Abdul / Abdel), a missing or extra middle name, swapped word order and initials.
Never pick a candidate just because it is the only one; a different person with a similar name is the main risk, so use "low" confidence or null when unsure.
When several candidates have the identical name, only pick one if the trade or supplier clearly points to it; otherwise null.
Answer only with the requested JSON.`;

export async function suggestWorkerMatches(issues: PlacementIssue[]): Promise<PlacementIssue[]> {
  const withCandidates = issues.filter((i) => i.candidates.length > 0).slice(0, 40);
  // Without the model, a clear lead in spelling is still worth showing.
  const heuristic = (i: PlacementIssue): PlacementIssue["ai"] | undefined => {
    const [a, b] = i.candidates;
    if (i.kind === "close" && a && a.score >= 0.9 && (!b || b.score < 0.7)) return { id: a.id, confidence: "medium", reason: "Closest spelling on record." };
    return undefined;
  };
  const out = issues.map((i) => ({ ...i, ai: heuristic(i) }));
  if (withCandidates.length === 0 || !process.env.ANTHROPIC_API_KEY) return out;
  try {
    const client = new Anthropic({ maxRetries: 0, timeout: 25_000 });
    const response = await client.messages.create({
      model: COPILOT_MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: `Typed names and candidates (JSON data):\n${JSON.stringify(withCandidates.map((i) => ({ key: i.key, typed: i.fileName, candidates: i.candidates.map((c) => ({ employeeId: c.id, name: c.name, code: c.code, trade: c.trade, supplier: c.supplier })) })))}`,
      }],
    });
    const block = response.content.find((b) => b.type === "text");
    if (response.stop_reason === "refusal" || block?.type !== "text") return out;
    const parsed = JSON.parse(block.text) as { picks?: { key?: string; employeeId?: string | null; confidence?: string; reason?: string }[] };
    const byKey = new Map(out.map((i) => [i.key, i]));
    for (const p of parsed.picks ?? []) {
      const issue = p.key ? byKey.get(p.key) : undefined;
      if (!issue) continue;
      const confidence = p.confidence === "high" || p.confidence === "medium" ? p.confidence : "low";
      // Only someone from the shortlist counts.
      if (p.employeeId && !issue.candidates.some((c) => c.id === p.employeeId)) continue;
      issue.ai = { id: p.employeeId ?? null, confidence, reason: String(p.reason ?? "").slice(0, 200) };
    }
  } catch (e) {
    console.error("[import-worker-match] model call failed:", e instanceof Error ? e.message : e);
  }
  return out;
}
