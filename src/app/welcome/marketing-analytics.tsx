import Script from "next/script";
import { CLARITY_LOADER } from "@/lib/clarity";

/**
 * Google Tag Manager + Microsoft Clarity for the marketing site. (The staff
 * app loads its own, masked Clarity tag — see (app)/app-analytics.tsx — and
 * never GTM.) Shared by the homepage layout and every
 * root-level content/landing page (via ContentShell), since only the
 * homepage nests under welcome/layout.tsx.
 */
export function MarketingAnalytics() {
  return (
    <>
      {/* beforeInteractive so the container (and anything it fires) loads
          ahead of the rest of the page. */}
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

      <Script id="ms-clarity" strategy="afterInteractive">
        {CLARITY_LOADER}
      </Script>
    </>
  );
}
