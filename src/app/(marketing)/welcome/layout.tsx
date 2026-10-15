import type { Metadata } from "next";
import { JsonLd, organizationLd, softwareLd, websiteLd } from "@/lib/seo/jsonld";
import { OG_IMAGE, SITE_URL } from "@/lib/seo/site";
import { SITE } from "./content";
import { MarketingAnalytics } from "./marketing-analytics";

const description =
  "Timesheets, WPS payroll, client invoicing, camps, transport and documents for UAE manpower suppliers, with employee and supplier portals.";

const KEYWORDS = [
  "manpower management software UAE",
  "labour supply software Dubai",
  "construction workforce management UAE",
  "subcontractor management software UAE",
  "WPS payroll software UAE",
  "timesheet software construction UAE",
  "camp and accommodation management software",
  "manpower supplier ERP",
  "manpower ERP",
  "manpower ERP UAE",
  "manpower ERP software",
];

export const metadata: Metadata = {
  title: { absolute: `${SITE.name}: ${SITE.tagline}` },
  description,
  keywords: KEYWORDS,
  // The marketing site is the one part of this app that should be indexed —
  // everything else defaults to noindex (see the root layout).
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: `${SITE.name}: ${SITE.tagline}`,
    description,
    type: "website",
    url: SITE_URL,
    siteName: SITE.name,
    locale: "en_AE",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name}: ${SITE.tagline}`,
    description,
    images: [OG_IMAGE],
  },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={[organizationLd(SITE.salesEmail), websiteLd(), softwareLd(description)]} />
      <MarketingAnalytics />
      {children}
    </>
  );
}
