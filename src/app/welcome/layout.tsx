import type { Metadata } from "next";
import Script from "next/script";
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
  "Timesheets, payroll with WPS, client invoicing, camps, transport and documents for manpower suppliers in the UAE, in one platform with employee and supplier portals.";

const KEYWORDS = [
  "manpower management software UAE",
  "labour supply software Dubai",
  "construction workforce management UAE",
  "subcontractor management software UAE",
  "WPS payroll software UAE",
  "timesheet software construction UAE",
  "camp and accommodation management software",
  "manpower supplier ERP",
];

const SITE_URL = "https://manpowersync.com";

export const metadata: Metadata = {
  title: { absolute: `${SITE.name}: ${SITE.tagline}` },
  description,
  keywords: KEYWORDS,
  icons: { icon: BRAND_ICON },
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
    images: [{ url: "/brand-assets/logo-full.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name}: ${SITE.tagline}`,
    description,
    images: ["/brand-assets/logo-full.png"],
  },
};

// Organization + SoftwareApplication structured data, so search engines can
// show rich results (logo in the knowledge panel, software category/pricing).
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE.name,
      url: SITE_URL,
      logo: `${SITE_URL}/brand-assets/logo-full.png`,
      email: SITE.salesEmail,
      areaServed: { "@type": "Country", name: "United Arab Emirates" },
    },
    {
      "@type": "SoftwareApplication",
      name: SITE.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description,
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: { "@type": "Offer", availability: "https://schema.org/InStock" },
    },
  ],
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${dmSans.variable} ${jakarta.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* Google Tag Manager — marketing-site analytics only, not the
          authenticated app. beforeInteractive so the container (and
          anything it fires) loads ahead of the rest of the page. */}
      <Script id="gtm-script" strategy="beforeInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','GTM-TR7NVRT2');`}
      </Script>
      <noscript>
        <iframe
          src="https://www.googletagmanager.com/ns.html?id=GTM-TR7NVRT2"
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
          title="Google Tag Manager"
        />
      </noscript>

      {/* Microsoft Clarity — marketing-site analytics only, not the authenticated app. */}
      <Script id="ms-clarity" strategy="afterInteractive">
        {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "yox1polsck");`}
      </Script>
      {children}
    </div>
  );
}
