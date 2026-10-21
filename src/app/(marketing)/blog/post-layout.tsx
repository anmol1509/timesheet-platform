import { Children, Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { JsonLd, articleLd } from "@/lib/seo/jsonld";
import { NextStep, ShowcaseCta, ShowcaseRoot, ToolHero } from "@/app/(marketing)/welcome/showcase/showcase";
import { BlogCard, formatDate } from "./blog-card";
import { clusterOf, relatedPosts } from "./clusters";
import { COVERS } from "./covers";
import type { Post } from "./posts";
import b from "./blog.module.css";

const textOf = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
};

const slugify = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Gives every h2 an id, collects them for the contents list and counts words for the reading time. */
function prepare(children: ReactNode) {
  const toc: { id: string; text: string }[] = [];
  let words = 0;
  const walk = (node: ReactNode): ReactNode => {
    if (isValidElement(node)) {
      const el = node as ReactElement<{ children?: ReactNode }>;
      if (el.type === "h2") {
        const text = textOf(el.props.children);
        let id = slugify(text) || `section-${toc.length + 1}`;
        if (toc.some((t) => t.id === id)) id = `${id}-${toc.length + 1}`;
        toc.push({ id, text });
        words += text.split(/\s+/).length;
        return cloneElement(el, { id } as object);
      }
      if (el.type === Fragment) return cloneElement(el, undefined, Children.toArray(el.props.children).map(walk));
      words += textOf(el).split(/\s+/).filter(Boolean).length;
      return el;
    }
    words += textOf(node).split(/\s+/).filter(Boolean).length;
    return node;
  };
  const nodes = Children.toArray(children).map(walk);
  return { nodes, toc, minutes: Math.max(1, Math.round(words / 220)) };
}

const ARTICLE_CLASS = [
  "text-[17px] leading-[1.7] text-[var(--charcoal)]",
  "[&>p]:my-5",
  "[&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:text-[clamp(24px,3vw,30px)] [&_h2]:font-extrabold [&_h2]:leading-[1.25] [&_h2]:tracking-[-0.4px] [&_h2]:text-[var(--ink)]",
  "[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-[19px] [&_h3]:font-bold [&_h3]:text-[var(--ink)]",
  "[&_ul]:my-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6",
  "[&_ol]:my-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6",
  "[&_li]:text-[var(--slate)]",
  "[&>p]:text-[var(--slate)]",
  "[&_strong]:font-semibold [&_strong]:text-[var(--ink)]",
  "[&_a]:font-medium [&_a]:text-[var(--primary)] [&_a]:underline [&_a]:underline-offset-2",
  "[&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[15px]",
  "[&_th]:border-b [&_th]:border-[var(--line,#e5e7eb)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[var(--ink)]",
  "[&_td]:border-b [&_td]:border-[var(--line,#e5e7eb)] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-[var(--slate)]",
].join(" ");

/** Shared chrome for every blog post: hero, topic cover, contents list, Article structured data
 * (so it can't drift between posts), a link to the product page the topic supports, and related posts. */
export function PostLayout({ post, children }: { post: Post; children: React.ReactNode }) {
  const cluster = clusterOf(post.cluster);
  const pillar = cluster.pillars[0];
  const cover = COVERS[post.cluster];
  const { nodes, toc, minutes } = prepare(children);
  return (
    <ShowcaseRoot accent={cover.accent}>
      <ToolHero
        pill={cluster.label}
        pillIcon={<BookOpen size={14} aria-hidden />}
        title={post.title}
        lead={post.description}
        badges={[formatDate(post.date), `${minutes} min read`]}
        plain
      />

      <div className={b.cover} style={{ padding: "0 24px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public */}
        <img src={cover.src} width={1200} height={630} alt={cover.alt} fetchPriority="high" decoding="async" />
      </div>

      <section style={{ padding: "64px 24px 24px" }}>
        <div className={b.postGrid} style={{ maxWidth: 1180, margin: "0 auto" }}>
          <article className={`${b.article} ${ARTICLE_CLASS}`}>
            <JsonLd
              data={articleLd({
                path: `/blog/${post.slug}`,
                title: post.title,
                description: post.description,
                datePublished: post.date,
                dateModified: post.updated,
              })}
            />
            {nodes}
          </article>
          {toc.length > 2 && (
            <nav className={b.toc} aria-label="In this article">
              <strong>In this article</strong>
              <ol>
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`}>{t.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </div>

        <div className={b.callout}>
          <NextStep
            title="The product behind this topic."
            body={`${pillar.label}: see how ManpowerSync handles ${cluster.label}.`}
            href={pillar.href}
            label={`Explore ${pillar.label}`}
          />
        </div>

        <div className={b.related} style={{ maxWidth: 1180, margin: "64px auto 0" }}>
          <h2 style={{ margin: "0 0 22px", fontFamily: "var(--font-jakarta), system-ui, sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: -0.6, color: "var(--ink)" }}>Keep reading</h2>
          <div className={b.grid}>
            {relatedPosts(post).map((p) => (
              <BlogCard key={p.slug} post={p} />
            ))}
          </div>
          <p style={{ margin: "36px 0 0" }}>
            <a href="/blog" style={{ fontWeight: 600, color: "var(--primary)" }}>
              &larr; Back to the blog
            </a>
          </p>
        </div>
      </section>

      <ShowcaseCta title="See it on your own numbers." lead="A 30-minute call with your own timesheet workbook is all it takes." />
    </ShowcaseRoot>
  );
}
