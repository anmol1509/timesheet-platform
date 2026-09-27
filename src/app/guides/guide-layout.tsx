import Link from "next/link";
import type { Guide } from "./guides-data";

/** Shared article chrome for product guides — same shape as the blog's
 * PostLayout, kept separate since guides and blog posts are conceptually
 * different content (how-to vs. reading) and may diverge later. */
export function GuideLayout({ guide, children }: { guide: Guide; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-5 py-14">
      <Link href="/guides" className="text-sm font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
        &larr; Guides
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">{guide.title}</h1>
      <div className="prose-content mt-8 space-y-5 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-900 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_strong]:text-slate-900">
        {children}
      </div>
    </article>
  );
}
