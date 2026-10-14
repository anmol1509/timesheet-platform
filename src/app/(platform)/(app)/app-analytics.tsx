import Script from "next/script";
import { CLARITY_LOADER } from "@/lib/clarity";

/**
 * Microsoft Clarity session recordings for the staff app, so dashboard use
 * shows up next to the marketing site's recordings.
 *
 * Every screen here carries salaries, IBANs, passport and Emirates ID numbers,
 * so the whole page is masked before the tag loads: recordings keep clicks,
 * scrolling, navigation and rage/dead clicks, but no text or images. The
 * desktop sidebar opts back in (data-clarity-unmask in app-shell.tsx) so you
 * can still see which module someone is in. Dialogs and menus portal straight
 * into <body>, which is why the mask sits on <body> and not the shell.
 *
 * The user is identified by internal id only (Clarity hashes it again before
 * sending) and tagged with their role, so "area = app" filters these sessions
 * from the marketing ones in the shared Clarity project.
 */
export function AppAnalytics({ userId, role }: { userId: string; role: string }) {
  if (process.env.NODE_ENV !== "production") return null;
  const js = (v: string) => JSON.stringify(v).replace(/</g, "\\u003c");
  return (
    <Script id="ms-clarity-app" strategy="afterInteractive">
      {`document.body.setAttribute("data-clarity-mask", "true");
${CLARITY_LOADER}
window.clarity("identify", ${js(userId)});
window.clarity("set", "area", "app");
window.clarity("set", "role", ${js(role)});`}
    </Script>
  );
}
