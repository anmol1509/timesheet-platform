import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * 404 for URLs that match no route at all. The app has two root layouts
 * (marketing and platform), so there is no single layout to compose this from;
 * Next renders this file directly, with its own <html>. It's prerendered, so it
 * can't tell the marketing domain from the app domain — the copy is neutral and
 * "/" is the right place to send people on both (homepage, or dashboard once
 * signed in).
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" data-theme="light">
      <body className="flex min-h-screen items-center justify-center bg-canvas text-[var(--text)] antialiased">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-base font-semibold text-primary">Page not found</h1>
          <p className="mt-1.5 text-sm text-muted">
            That address doesn&rsquo;t match anything here. It may have been renamed, or the link is out of date.
          </p>
          <div className="mt-5 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- plain anchor on purpose: this page renders outside any layout, so no router context is available */}
            <a href="/" className="btn btn-primary btn-sm">Go to the home page</a>
          </div>
        </div>
      </body>
    </html>
  );
}
