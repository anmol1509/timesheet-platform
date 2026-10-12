import Anthropic from "@anthropic-ai/sdk";
import { COPILOT_MODEL } from "@/lib/constants";
import { nameSimilarity } from "./workerMatch";
import type { NewSupplier } from "./types";

type Existing = { id: string; name: string };

/**
 * Helps with supplier, client and project names in a file that aren't on record:
 * is it really one you already have, spelled differently? The model only sees the
 * typed name and a short list of similar names already on record, may only pick from
 * that list, and the person still decides each one on the review screen.
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
          id: { type: ["string", "null"] as unknown as "string" },
          confidence: { type: "string" as const, enum: ["high", "medium", "low"] },
          reason: { type: "string" as const },
        },
        required: ["key", "id", "confidence", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["picks"],
  additionalProperties: false,
};

const SYSTEM = `You compare company, client and project names typed in a spreadsheet with ones already on record for a UAE manpower company.
For each typed name you get a short list of names on record. Pick the one that is the same organisation or project written differently (abbreviations such as LLC / L.L.C., Co / Company, a dropped word, spelling), or null if none clearly is.
A different company with a similar name is the main risk: use "low" confidence or null when unsure. Answer only with the requested JSON.`;

const TIMEOUT_MS = 20_000;

export async function suggestPartyMatches(
  items: NewSupplier[],
  pools: { supplier: Existing[]; client: Existing[]; project: Existing[] },
): Promise<NewSupplier[]> {
  const shortlist = (n: NewSupplier) => {
    const pool = pools[n.party ?? "supplier"] ?? [];
    // Project labels read "Name (Client)"; compare on the name part.
    const typed = n.name.replace(/\s*\([^)]*\)\s*$/, "");
    return pool.map((p) => ({ ...p, score: nameSimilarity(typed, p.name) })).filter((p) => p.score >= 0.6).sort((a, b) => b.score - a.score).slice(0, 5);
  };
  const lists = new Map(items.map((n) => [n.key, shortlist(n)]));
  const out: NewSupplier[] = items.map((n) => {
    const [a, b] = lists.get(n.key) ?? [];
    return a && a.score >= 0.92 && (!b || b.score < 0.75) ? { ...n, ai: { id: a.id, name: a.name, confidence: "medium" as const, reason: "Almost the same spelling." } } : n;
  });
  const asked = out.filter((n) => (lists.get(n.key)?.length ?? 0) > 0).slice(0, 40);
  if (asked.length === 0 || !process.env.ANTHROPIC_API_KEY) return out;
  try {
    const client = new Anthropic({ maxRetries: 0, timeout: TIMEOUT_MS });
    const response = await client.messages.create({
      model: COPILOT_MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: `Typed names and names on record (JSON data):\n${JSON.stringify(asked.map((n) => ({ key: n.key, kind: n.party ?? "supplier", typed: n.name, onRecord: lists.get(n.key)!.map((c) => ({ id: c.id, name: c.name })) })))}` }],
    });
    const block = response.content.find((b) => b.type === "text");
    if (response.stop_reason === "refusal" || block?.type !== "text") return out;
    const parsed = JSON.parse(block.text) as { picks?: { key?: string; id?: string | null; confidence?: string; reason?: string }[] };
    for (const p of parsed.picks ?? []) {
      const item = out.find((n) => n.key === p.key);
      if (!item) continue;
      const cands = lists.get(item.key) ?? [];
      const hit = p.id ? cands.find((c) => c.id === p.id) : undefined;
      if (p.id && !hit) continue; // only names from the shortlist count
      const confidence = p.confidence === "high" || p.confidence === "medium" ? p.confidence : "low";
      item.ai = { id: hit?.id ?? null, name: hit?.name, confidence, reason: String(p.reason ?? "").slice(0, 200) };
    }
  } catch (e) {
    console.error("[import-party-match] model call failed:", e instanceof Error ? e.message : e);
  }
  return out;
}
