// Snapshots the /welcome landing page into a standalone static site (no Next.js
// runtime) for hosting on the marketing domain.
//
//   NEXT_PUBLIC_APP_URL=https://app.example.com npm run build
//   npx next start -p 3000 &
//   node scripts/export-landing.mjs http://localhost:3000 .landing-dist
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const outDir = process.argv[3] ?? ".landing-dist";

async function get(url, as = "text") {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return as === "text" ? res.text() : Buffer.from(await res.arrayBuffer());
}

const html = await get(`${base}/welcome`);
const head = html.slice(0, html.indexOf("</head>"));

const pageStart = html.indexOf('<div id="top"');
if (pageStart < 0) throw new Error("Landing page markup not found; is /welcome rendering?");
// The font-variable wrapper from welcome/layout.tsx sits directly around #top.
const wrapStart = html.lastIndexOf("<div", pageStart - 1);
const wrapClass = html.slice(wrapStart).match(/^<div class="([^"]+)">/)?.[1];
if (!wrapClass) throw new Error("Font wrapper around #top not found");
const footerClose = html.indexOf("</footer>", pageStart) + "</footer>".length;
// The wrapper div and #top's own div close right after </footer>, possibly
// with a React hydration comment (<!--$-->...) in between.
const afterFooter = html.slice(footerClose, footerClose + 200);
const closeMatch = afterFooter.match(/^(?:<!--[\s\S]*?-->)*<\/div>(?:<!--[\s\S]*?-->)*<\/div>/);
if (!closeMatch) throw new Error(`Could not find closing divs after </footer>: ${afterFooter}`);
const bodyEnd = footerClose + closeMatch[0].length;
const pageClass = html.slice(pageStart).match(/class="([^"]+)"/)[1];

const markup = html
  .slice(wrapStart, bodyEnd)
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<!--[\s\S]*?-->/g, "");

const metas = [
  ...head.matchAll(/<title>[\s\S]*?<\/title>|<meta (?:name="description"|property="og:[^"]+")[^>]*\/>/g),
].map((m) => m[0]);

let css = "";
const fonts = new Set();
for (const href of [...head.matchAll(/<link rel="stylesheet" href="([^"]+\.css)"/g)].map((m) => m[1])) {
  const text = await get(base + href);
  if (!text.includes(`.${wrapClass}`) && !text.includes(`.${pageClass}`)) continue;
  css += text.replace(/url\(\.\.\/media\/([^)]+)\)/g, (_, file) => {
    fonts.add(file);
    return `url(/fonts/${file})`;
  });
}
css = css.replace(/\/\*# sourceMappingURL=.*?\*\//g, "");

const favicon =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="7" fill="#0a1530"/><rect x="6" y="6" width="7" height="7" rx="2" fill="#f5d75e"/><rect x="15" y="6" width="7" height="7" rx="2" fill="#ff64c8"/><rect x="6" y="15" width="7" height="7" rx="2" fill="#2a9d99"/><rect x="15" y="15" width="7" height="7" rx="2" fill="#fff"/></svg>'
  );

const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${metas.join("\n")}
<link rel="icon" href="${favicon}">
<style>body{margin:0}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}${css}</style>
</head>
<body>
${markup}
<script>
document.querySelectorAll("details a").forEach(function (a) {
  a.addEventListener("click", function () { a.closest("details").removeAttribute("open"); });
});
</script>
</body>
</html>
`;

await mkdir(path.join(outDir, "fonts"), { recursive: true });
await writeFile(path.join(outDir, "index.html"), doc);
for (const file of fonts) {
  await writeFile(path.join(outDir, "fonts", file), await get(`${base}/_next/static/media/${file}`, "buffer"));
}
console.log(`Wrote ${outDir}/index.html (${doc.length} bytes) and ${fonts.size} font files`);
