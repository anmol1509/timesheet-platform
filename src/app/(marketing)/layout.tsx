import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "../globals.css";
import { FormValidation } from "@/components/FormValidation";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { SITE_URL } from "@/lib/seo/site";

/**
 * Root layout for the public marketing site (manpowersync.com). It is a root
 * layout of its own, separate from the staff app's, so that nothing here reads
 * cookies or headers: every marketing page can then be prerendered at build
 * time and served from the CDN instead of running a server function per visit.
 * Keep it that way — a cookies()/headers()/searchParams read anywhere in this
 * group turns the affected pages dynamic again.
 *
 * Always light (the staff app's theme cookie never applies here).
 */
const dmSans = DM_Sans({
  weight: ["400", "500", "600"],
  variable: "--font-dm",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "ManpowerSync", template: "%s | ManpowerSync" },
  description: "Timesheets, WPS payroll, client invoicing, camps and compliance for UAE manpower suppliers.",
  robots: { index: true, follow: true },
};

// Footer year and any registry edits refresh daily without a redeploy.
export const revalidate = 86400;

export default function MarketingRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" className={`${dmSans.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas text-[var(--text)]">
        <FormValidation />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
