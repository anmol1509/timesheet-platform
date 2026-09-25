import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { FormValidation } from "@/components/FormValidation";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { THEME_COOKIE, isThemePreference } from "@/lib/theme-preference";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Workforce ERP",
    template: "%s • Workforce ERP",
  },
  description:
    "Workforce, projects, timesheets and billing for construction manpower suppliers.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themePref = cookieStore.get(THEME_COOKIE)?.value;
  // Default to light regardless of the visitor's OS/browser preference —
  // only an explicit choice (the ThemeToggle's Light/Dark, stored in this
  // cookie) should switch it. Without this, an unset cookie fell through to
  // the `@media (prefers-color-scheme: dark)` rule in globals.css and the
  // app opened dark for anyone whose system was in dark mode.
  const dataTheme = isThemePreference(themePref) ? themePref : "light";

  return (
    <html
      lang="en"
      data-theme={dataTheme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-[var(--text)]">
        <FormValidation />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
