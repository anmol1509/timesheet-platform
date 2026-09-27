import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "../content-shell";
import { POSTS } from "./posts";

const TITLE = "Blog";
const DESCRIPTION =
  "Practical guidance on UAE WPS payroll, visa and Emirates ID compliance, and running a manpower supply business — from the team building ManpowerSync.";
const URL = "https://manpowersync.com/welcome/blog";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AE", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogIndexPage() {
  return (
    <ContentShell>
      <section className="mx-auto max-w-3xl px-5 pt-14 pb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Blog</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{DESCRIPTION}</p>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-16">
        <ul className="space-y-8">
          {POSTS.map((post) => (
            <li key={post.slug} className="border-b border-slate-100 pb-8 last:border-0">
              <p className="text-xs text-slate-400">{formatDate(post.date)}</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                <Link href={`/welcome/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{post.description}</p>
              <Link
                href={`/welcome/blog/${post.slug}`}
                className="mt-3 inline-block text-sm font-medium text-[var(--brand-primary,#5645d4)] hover:underline"
              >
                Read more &rarr;
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </ContentShell>
  );
}
