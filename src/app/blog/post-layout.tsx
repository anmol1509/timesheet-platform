import Link from "next/link";
import type { Post } from "./posts";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AE", { day: "numeric", month: "long", year: "numeric" });
}

/** Shared article chrome (title, date, back-to-blog link, prose styling) so
 * each post only has to write its own body content. */
export function PostLayout({ post, children }: { post: Post; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-5 py-14">
      <Link href="/blog" className="text-sm font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
        &larr; Blog
      </Link>
      <p className="mt-6 text-xs text-slate-400">{formatDate(post.date)}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{post.title}</h1>
      <div className="prose-content mt-8 space-y-5 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_strong]:text-slate-900">
        {children}
      </div>
    </article>
  );
}
