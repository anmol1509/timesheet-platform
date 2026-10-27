import { BookDemoButton } from "@/components/BookDemoButton";

const SITE = "https://manpowersync.com";
const LINKS = [
  { label: "Product", href: `${SITE}/features` },
  { label: "Solutions", href: `${SITE}/solutions` },
  { label: "Resources", href: `${SITE}/guides` },
  { label: "Pricing", href: `${SITE}/pricing` },
];

/**
 * The floating pill header the public website uses, on the sign-in pages so moving between the two feels like one site.
 * A customer's own deployment (RKG, Burj Al Aweer and so on) shows only the logo and "Sign in": the website menus and the
 * demo form are for ManpowerSync's own site.
 */
export function AuthHeader({ customerApp }: { customerApp: boolean }) {
  return (
    <header className="fixed inset-x-4 top-4 z-40 mx-auto flex h-[60px] max-w-[1100px] items-center gap-6 rounded-full border border-[#e3e5ee] bg-white/80 pr-3 pl-6 shadow-[0_10px_30px_rgb(30_30_80_/_0.08)] backdrop-blur">
      <a href={SITE} aria-label="ManpowerSync home" className="flex shrink-0 items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static file, no loader needed */}
        <img src="/brand-assets/logo-header.png" alt="ManpowerSync" height={40} width={206} className="h-10 w-auto" />
      </a>
      {!customerApp && (
        <nav aria-label="Website" className="hidden items-center gap-8 pl-6 text-[15px] text-[#1a1a1a] md:flex">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} className="transition hover:text-[var(--brand-primary)]">{l.label}</a>
          ))}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-3">
        <a href="/login" aria-current="page" className="border-b-2 border-[var(--brand-primary)] px-1 pb-0.5 text-[15px] font-semibold text-[#14132b]">Sign in</a>
        {!customerApp && (
          <BookDemoButton className="hidden rounded-xl bg-[var(--brand-primary)] px-5 py-2.5 text-[15px] font-medium text-white transition hover:brightness-110 sm:inline-flex">Book a demo</BookDemoButton>
        )}
      </div>
    </header>
  );
}
