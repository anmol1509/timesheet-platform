// Single place for the marketing site's identity, so robots, sitemap, proxy,
// metadata and JSON-LD can't disagree about the host or the brand.
export const SITE_HOST = "manpowersync.com";
export const SITE_URL = `https://${SITE_HOST}`;
export const SITE_NAME = "ManpowerSync";
export const OG_IMAGE = "/brand-assets/og-default.png";

/** The apex marketing domain or its www alias (the proxy 308s www to the apex). */
export function isMarketingHost(host: string | null): boolean {
  return host === SITE_HOST || host === `www.${SITE_HOST}`;
}
