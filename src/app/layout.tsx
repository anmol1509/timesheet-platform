import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
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
    default: "Burj Al Aweer ERP",
    template: "%s • Burj Al Aweer ERP",
  },
  description:
    "Workforce, projects, timesheets and billing for Burj Al Aweer construction manpower.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themePref = cookieStore.get(THEME_COOKIE)?.value;
  const dataTheme = isThemePreference(themePref) ? themePref : undefined;

  return (
    <html
      lang="en"
      data-theme={dataTheme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-[var(--text)]">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
