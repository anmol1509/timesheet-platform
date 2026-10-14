import type { Metadata } from "next";
import { OG_IMAGE, SITE_NAME } from "./site";

const MAX_TITLE = 60;
const MAX_DESCRIPTION = 158;

function clampDescription(text: string): string {
  if (text.length <= MAX_DESCRIPTION) return text;
  const cut = text.slice(0, MAX_DESCRIPTION - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:—-]+$/, "")}…`;
}

/**
 * Every marketing page runs its metadata through here so brand suffix, share
 * image, OG/Twitter defaults and snippet lengths can't drift page by page.
 *
 * - A plain title gets " | ManpowerSync" unless that would pass 60 characters,
 *   in which case it stands alone. `{ absolute }` titles are left as written.
 * - openGraph/twitter get the site name, locale and a 1200x630 share image
 *   (Next replaces nested objects rather than merging, so each page needs them).
 * - Blog posts and guides are "article"; everything else is "website".
 */
export function finishMetadata(meta: Metadata): Metadata {
  const raw = meta.title;
  const plain = typeof raw === "string" ? raw : raw && "absolute" in raw ? raw.absolute : "";
  const branded = `${plain} | ${SITE_NAME}`;
  const title = typeof raw === "string" ? { absolute: branded.length <= MAX_TITLE ? branded : plain } : raw;
  const description = meta.description ? clampDescription(meta.description) : undefined;

  const url = typeof meta.alternates?.canonical === "string" ? meta.alternates.canonical : undefined;
  const isArticle = !!url && /\/(blog|guides)\/[^/]+$/.test(url);
  const image = { url: OG_IMAGE, width: 1200, height: 630, alt: `${SITE_NAME}: timesheets, WPS payroll and billing for UAE manpower suppliers` };

  return {
    ...meta,
    title,
    description,
    robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    openGraph: {
      ...meta.openGraph,
      title: plain,
      description,
      url,
      siteName: SITE_NAME,
      locale: "en_AE",
      type: (isArticle ? "article" : "website") as "article" | "website",
      images: [image],
    } as Metadata["openGraph"],
    twitter: { card: "summary_large_image", title: plain, description, images: [OG_IMAGE] },
  };
}
