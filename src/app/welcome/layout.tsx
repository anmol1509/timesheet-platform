import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BRAND_ICON } from "@/lib/brand-assets";
import { SITE } from "./content";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
  return <div className={inter.variable}>{children}</div>;
}
