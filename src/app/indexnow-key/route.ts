import indexnow from "@/lib/seo/indexnow.json";

/**
 * The IndexNow ownership file. Bing and the other IndexNow engines fetch https://<host>/<key>.txt and expect the key
 * as plain text; next.config.ts rewrites that address here, and the request still carries the address that was asked
 * for, so only the real key's file answers.
 */
export function GET(request: Request) {
  if (new URL(request.url).pathname !== `/${indexnow.key}.txt`) return new Response("Not found", { status: 404 });
  return new Response(indexnow.key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
