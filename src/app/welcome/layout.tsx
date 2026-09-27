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
  return (
    <div className={`${dmSans.variable} ${jakarta.variable}`}>
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
