import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser, isBlockedByPermissions, resolveSuperAdminBranchId, subjectOf } from "@/lib/auth";
import { moduleForPath, viewableModules } from "@/lib/permissions";
import { ASSISTANT_LIMIT, rateLimit } from "@/lib/rateLimit";
import { ASSISTANT_MODEL } from "@/lib/constants";
import { TOOLS, runTool, type RecordLink } from "@/lib/assistantTools";
import {
  EXTRA_PAGES,
  MAX_MESSAGES,
  MAX_MESSAGE_CHARS,
  REPLY_SCHEMA,
  buildSystemPrompt,
  type GuidePage,
} from "@/lib/assistantGuide";

const MAX_TOOL_ROUNDS = 3;

type ChatMessage = { role: "user" | "assistant"; content: string };

function isInternalPath(href: unknown): href is string {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && href.length < 200;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await isBlockedByPermissions(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limit = rateLimit(`assistant:${user.id}`, ASSISTANT_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "You've asked a lot of questions — try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: { messages?: unknown; pages?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const messages: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter(
      (m): m is ChatMessage =>
        !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== ""
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  // The API needs the conversation to open and close on the user.
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }

  // Sidebar rows come from the client (that's where the nav is defined); the
  // module filter is re-applied here so a tampered list can't widen access.
  // Real access is enforced by the proxy/page gate regardless.
  const allowed = viewableModules(subjectOf(user));
  const isAdmin = user.role !== "STAFF";
  const sent: GuidePage[] = (Array.isArray(body.pages) ? body.pages : [])
    .slice(0, 100)
    .filter((p): p is GuidePage => !!p && isInternalPath(p.href) && typeof p.label === "string" && typeof p.group === "string")
    .map((p) => ({ href: p.href, label: p.label.slice(0, 60), group: p.group.slice(0, 40) }));
  const seen = new Set<string>();
  const pages = [...sent, ...EXTRA_PAGES].filter((p) => {
    if (seen.has(p.href)) return false;
    const mod = moduleForPath(p.href);
    // Module-less rows: dashboard is open to all; /settings, /lookups etc. are admin-only.
    if (mod === null && p.href !== "/" && !isAdmin) return false;
    if (mod !== null && allowed && !allowed.includes(mod)) return false;
    seen.add(p.href);
    return true;
  });

  try {
    const client = new Anthropic();
    const system = buildSystemPrompt(pages);
    const branchId = user.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId() : user.branchId;
    const ctx = { subject: subjectOf(user), branchId };
    const convo: Anthropic.Messages.MessageParam[] = [...messages];
    const recordLinks: RecordLink[] = [];

    let text: Anthropic.Messages.TextBlock | undefined;
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      // The last round offers no tools, so the loop always ends on an answer.
      const response = await client.messages.create({
        model: ASSISTANT_MODEL,
        max_tokens: 600,
        system,
        output_config: { format: { type: "json_schema", schema: REPLY_SCHEMA } },
        messages: convo,
        ...(round < MAX_TOOL_ROUNDS ? { tools: TOOLS } : {}),
      });
      if (response.stop_reason === "refusal") break;
      if (response.stop_reason !== "tool_use") {
        const block = response.content.find((b) => b.type === "text");
        text = block?.type === "text" ? block : undefined;
        break;
      }
      convo.push({ role: "assistant", content: response.content });
      const results: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const out = await runTool(block.name, block.input, ctx);
        recordLinks.push(...(out.links ?? []));
        results.push({ type: "tool_result", tool_use_id: block.id, content: out.content });
      }
      convo.push({ role: "user", content: results });
    }
    if (!text) return NextResponse.json({ answer: "I can't help with that one.", links: [] });

    const parsed = JSON.parse(text.text) as { answer?: string; links?: { href?: string }[] };
    // Pages the user may open, plus records this same request's lookups returned.
    const byHref = new Map<string, GuidePage>([...pages, ...recordLinks].map((p) => [p.href, p]));
    const links = (parsed.links ?? [])
      .map((l) => (l.href ? byHref.get(l.href) : undefined))
      .filter((p): p is GuidePage => !!p)
      .slice(0, 3)
      .map((p) => ({ href: p.href, label: p.label, group: p.group }));
    return NextResponse.json({ answer: String(parsed.answer ?? "").slice(0, 1200), links });
  } catch (err) {
    console.error("assistant failed", err);
    return NextResponse.json({ error: "The assistant is unavailable right now." }, { status: 502 });
  }
}
