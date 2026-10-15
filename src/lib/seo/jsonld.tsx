import { SITE_NAME, SITE_URL } from "./site";

type Thing = Record<string, unknown>;

export const ORG_ID = `${SITE_URL}/#organization`;

/** One JSON-LD script. `<` is escaped so content can never close the tag early. */
export function JsonLd({ data }: { data: Thing | Thing[] }) {
  const graph = { "@context": "https://schema.org", "@graph": Array.isArray(data) ? data : [data] };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }}
    />
  );
}

export const organizationLd = (email: string): Thing => ({
  "@type": "Organization",
  "@id": ORG_ID,
  name: SITE_NAME,
  url: SITE_URL,
  logo: { "@type": "ImageObject", url: `${SITE_URL}/brand-assets/icon.png`, width: 458, height: 380 },
  email,
  areaServed: { "@type": "Country", name: "United Arab Emirates" },
});

export const websiteLd = (): Thing => ({
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: SITE_NAME,
  inLanguage: "en-AE",
  publisher: { "@id": ORG_ID },
});

export const softwareLd = (description: string): Thing => ({
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#software`,
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description,
  url: SITE_URL,
  publisher: { "@id": ORG_ID },
  // Public list prices from /pricing (monthly, per plan).
  offers: [
    { "@type": "Offer", name: "Basic (up to 200 members)", price: "500", priceCurrency: "AED", url: `${SITE_URL}/pricing`, availability: "https://schema.org/InStock" },
    { "@type": "Offer", name: "Pro (up to 500 members)", price: "1000", priceCurrency: "AED", url: `${SITE_URL}/pricing`, availability: "https://schema.org/InStock" },
  ],
});

export const articleLd = (p: {
  path: string;
  title: string;
  description: string;
  datePublished: string;
  dateModified?: string;
}): Thing => ({
  "@type": "Article",
  "@id": `${SITE_URL}${p.path}#article`,
  mainEntityOfPage: `${SITE_URL}${p.path}`,
  headline: p.title,
  description: p.description,
  image: `${SITE_URL}/brand-assets/og-default.png`,
  datePublished: p.datePublished,
  dateModified: p.dateModified ?? p.datePublished,
  inLanguage: "en-AE",
  author: { "@id": ORG_ID },
  publisher: { "@id": ORG_ID },
});

/** A free in-browser tool (calculator). Free, so the offer is price 0. */
export const webApplicationLd = (p: { path: string; name: string; description: string; category?: string }): Thing => ({
  "@type": "WebApplication",
  "@id": `${SITE_URL}${p.path}#tool`,
  name: p.name,
  description: p.description,
  url: `${SITE_URL}${p.path}`,
  applicationCategory: p.category ?? "BusinessApplication",
  operatingSystem: "Web",
  inLanguage: "en-AE",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "AED" },
  publisher: { "@id": ORG_ID },
});

export const faqLd = (items: readonly { q: string; a: string }[]): Thing => ({
  "@type": "FAQPage",
  mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});
