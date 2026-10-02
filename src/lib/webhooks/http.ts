import http from "http";
import https from "https";
import type { SafeTarget } from "./safeUrl";

export type PostResult = { status: number | null; snippet: string | null; error: string | null; durationMs: number };

const MAX_BODY = 2048;

/**
 * POSTs JSON to a target that has already passed the address check. It
 * connects to that exact address (so a name that changes its answer between the
 * check and the call can't redirect it), does not follow redirects, gives up
 * after the timeout, and reads only the start of the reply.
 */
export function postJson(target: SafeTarget, headers: Record<string, string>, body: string, timeoutMs = 10_000): Promise<PostResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const done = (r: Omit<PostResult, "durationMs">) => resolve({ ...r, durationMs: Date.now() - started });
    const { url } = target;
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      {
        method: "POST",
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        headers: { ...headers, "Content-Length": Buffer.byteLength(body).toString() },
        timeout: timeoutMs,
        // Connect to the address we checked, whatever the name resolves to now.
        lookup: (_host, _opts, cb) => (cb as unknown as (e: Error | null, address: string, family: number) => void)(null, target.address, target.family),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          if (size < MAX_BODY) chunks.push(c);
          size += c.length;
        });
        res.on("end", () => done({ status: res.statusCode ?? null, snippet: Buffer.concat(chunks).toString("utf8").slice(0, MAX_BODY) || null, error: null }));
        res.on("error", (e) => done({ status: res.statusCode ?? null, snippet: null, error: e.message }));
      }
    );
    req.on("timeout", () => {
      req.destroy();
      done({ status: null, snippet: null, error: `No reply within ${Math.round(timeoutMs / 1000)} seconds` });
    });
    req.on("error", (e) => done({ status: null, snippet: null, error: e.message || "Connection failed" }));
    req.end(body);
  });
}
