import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import { BRAND_ICON } from "@/lib/brand-assets";
import { SITE } from "./content";

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

const description =
  "Timesheets, payroll with WPS, client invoicing, camps, transport and documents for manpower suppliers, in one platform with employee and supplier portals.";

export const metadata: Metadata = {
  title: { absolute: `${SITE.name}: ${SITE.tagline}` },
  description,
  icons: { icon: BRAND_ICON },
  openGraph: {
    title: `${SITE.name}: ${SITE.tagline}`,
    description,
    type: "website",
  },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${dmSans.variable} ${jakarta.variable}`}>{children}</div>;
}
