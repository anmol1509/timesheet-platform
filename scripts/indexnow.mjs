// Tell IndexNow search engines (Bing and others) that pages are new or changed.
//
//   node scripts/indexnow.mjs                      submit every address in the live sitemap
//   node scripts/indexnow.mjs <url> <url> ...      submit just these addresses
//
// The key file is served at https://<host>/<key>.txt (see src/app/indexnow-key/route.ts).
import { readFileSync } from "node:fs";

const { key, host } = JSON.parse(readFileSync(new URL("../src/lib/seo/indexnow.json", import.meta.url), "utf8"));
const args = process.argv.slice(2).filter(Boolean);

async function sitemapUrls() {
  const res = await fetch(`https://${host}/sitemap.xml`);
  if (!res.ok) throw new Error(`Could not read the sitemap: HTTP ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

const urlList = (args.length ? args : await sitemapUrls()).filter((u) => new URL(u).host === host);
if (urlList.length === 0) throw new Error("No addresses to submit.");

// IndexNow accepts up to 10,000 per request.
for (let i = 0; i < urlList.length; i += 10000) {
  const batch = urlList.slice(i, i + 10000);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: batch }),
  });
  // 200 and 202 both mean accepted; 422 usually means the key file could not be verified yet.
  console.log(`Submitted ${batch.length} address(es): HTTP ${res.status}`);
  if (res.status !== 200 && res.status !== 202) {
    console.error(await res.text());
    process.exit(1);
  }
}
