import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser, isBlockedByPermissions, subjectOf } from "@/lib/auth";
import { moduleForPath, viewableModules } from "@/lib/permissions";
import { ASSISTANT_LIMIT, rateLimit } from "@/lib/rateLimit";
import { ASSISTANT_MODEL } from "@/lib/constants";
import {
  EXTRA_PAGES,
  MAX_MESSAGES,
  MAX_MESSAGE_CHARS,
  REPLY_SCHEMA,
  buildSystemPrompt,
  type GuidePage,
} from "@/lib/assistantGuide";

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
    const response = await new Anthropic().messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 400,
      system: buildSystemPrompt(pages),
      output_config: { format: { type: "json_schema", schema: REPLY_SCHEMA } },
      messages,
    });
    const text = response.content.find((b) => b.type === "text");
    if (response.stop_reason === "refusal" || !text || text.type !== "text") {
      return NextResponse.json({ answer: "I can't help with that one.", links: [] });
    }
    const parsed = JSON.parse(text.text) as { answer?: string; links?: { href?: string }[] };
    const byHref = new Map(pages.map((p) => [p.href, p]));
    const links = (parsed.links ?? [])
      .map((l) => (l.href ? byHref.get(l.href) : undefined))
      .filter((p): p is GuidePage => !!p)
      .slice(0, 3)
      .map((p) => ({ href: p.href, label: p.label, group: p.group }));
    return NextResponse.json({ answer: String(parsed.answer ?? "").slice(0, 800), links });
  } catch (err) {
    console.error("assistant failed", err);
    return NextResponse.json({ error: "The assistant is unavailable right now." }, { status: 502 });
  }
}
