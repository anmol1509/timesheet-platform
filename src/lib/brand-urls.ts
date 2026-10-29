// The same brand images as brand-assets.ts, but as files served from /public. The data-URI versions are about 100 KB of
// text each time they appear in a page, and the sidebar draws the logo twice on every screen. Files are cached by the
// browser and the CDN for a year; change the -v1 in the name to publish a new one.
export const BRAND_LOGO_URL = "/brand-assets/wordmark-v1.png";
export const BRAND_ICON_URL = "/brand-assets/mark-v1.png";
export const BRAND_LOGO_ASPECT = 5.1502;
