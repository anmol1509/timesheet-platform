import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "../globals.css";
import { FormValidation } from "@/components/FormValidation";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { ACCENT_COOKIE, DENSITY_COOKIE, TEXT_COOKIE, THEME_COOKIE, htmlAttributes, parsePreferences } from "@/lib/preferences";

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

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://manpowersync.com"),
  title: {
    default: "ManpowerSync",
    template: "%s • ManpowerSync",
  },
  description:
    "Workforce, projects, timesheets and billing for construction manpower suppliers.",
  // Default-closed: this app is a private, auth-gated system. Only the
  // marketing site (welcome/layout.tsx) opts back in to indexing.
  robots: { index: false, follow: false },
};

// Longest any page or save may run. Large payroll runs, bulk documents and imports can take a while on a big company.
export const maxDuration = 60;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  // The person's look-and-feel choices, mirrored in cookies so the first paint is already right. Unset means the
  // default (light, purple, comfortable): the app never switches to dark on its own, only when "system" is chosen.
  const prefs = parsePreferences({
    theme: cookieStore.get(THEME_COOKIE)?.value,
    accent: cookieStore.get(ACCENT_COOKIE)?.value,
    density: cookieStore.get(DENSITY_COOKIE)?.value,
    textSize: cookieStore.get(TEXT_COOKIE)?.value,
  });

  return (
    <html
      lang="en"
      {...htmlAttributes(prefs)}
      className={`${dmSans.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-[var(--text)]">
        <FormValidation />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
