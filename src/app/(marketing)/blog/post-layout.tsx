import { ArticleLayout } from "@/app/(marketing)/welcome/article-layout";
import { LinkCardGrid } from "@/app/(marketing)/welcome/content-blocks";
import { JsonLd, articleLd } from "@/lib/seo/jsonld";
import { clusterOf, relatedPosts } from "./clusters";
import type { Post } from "./posts";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AE", { day: "numeric", month: "long", year: "numeric" });
}

/** Shared chrome for every blog post: Article structured data (so it can't drift
 * between posts), related posts from the same topic cluster, and a link to the
 * product page that cluster supports. */
export function PostLayout({ post, children }: { post: Post; children: React.ReactNode }) {
  const cluster = clusterOf(post.cluster);
  const pillar = cluster.pillars[0];
  return (
    <ArticleLayout
      eyebrow={formatDate(post.date)}
      title={post.title}
      lead={post.description}
      backHref="/blog"
      backLabel="Back to the blog"
      ctaTitle="See it on your own numbers."
      ctaLead="A 30-minute call with your own timesheet workbook is all it takes."
      footer={
        <>
          <p style={{ margin: "0 0 16px", fontSize: 15, color: "var(--steel)" }}>
            More on <strong style={{ color: "var(--ink)" }}>{cluster.label.toLowerCase()}</strong>. The product behind this
            topic: <a href={pillar.href} style={{ color: "var(--primary)", fontWeight: 500 }}>{pillar.label}</a>.
          </p>
          <LinkCardGrid
            cards={relatedPosts(post).map((p) => ({ href: `/blog/${p.slug}`, title: p.title, body: p.description }))}
          />
        </>
      }
    >
      <JsonLd
        data={articleLd({
          path: `/blog/${post.slug}`,
          title: post.title,
          description: post.description,
          datePublished: post.date,
          dateModified: post.updated,
        })}
      />
      {children}
    </ArticleLayout>
  );
}
