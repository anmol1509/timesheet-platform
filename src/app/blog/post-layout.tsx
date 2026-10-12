import { ArticleLayout } from "@/app/welcome/article-layout";
import type { Post } from "./posts";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AE", { day: "numeric", month: "long", year: "numeric" });
}

export function PostLayout({ post, children }: { post: Post; children: React.ReactNode }) {
  return (
    <ArticleLayout
      eyebrow={formatDate(post.date)}
      title={post.title}
      lead={post.description}
      backHref="/blog"
      backLabel="Back to the blog"
      ctaTitle="See it on your own numbers."
      ctaLead="A 30-minute call with your own timesheet workbook is all it takes."
    >
      {children}
    </ArticleLayout>
  );
}
