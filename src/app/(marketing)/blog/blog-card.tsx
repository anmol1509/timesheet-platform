import { clusterOf } from "./clusters";
import { COVERS } from "./covers";
import type { Post } from "./posts";
import b from "./blog.module.css";

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AE", { day: "numeric", month: "long", year: "numeric" });
}

/** A post card with its topic cover. The accent is set on the card so each topic keeps its colour. */
export function BlogCard({ post, eager }: { post: Post; eager?: boolean }) {
  const cover = COVERS[post.cluster];
  const a = cover.accent;
  return (
    <a
      href={`/blog/${post.slug}`}
      className={b.card}
      style={{ "--x-accent": a.accent, "--x-soft": a.soft, "--x-ink": a.ink } as React.CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public */}
      <img src={cover.src} width={1200} height={630} alt={cover.alt} loading={eager ? "eager" : "lazy"} decoding="async" />
      <div className={b.cardBody}>
        <span className={b.tag}>{clusterOf(post.cluster).label}</span>
        <h3>{post.title}</h3>
        <p>{post.description}</p>
        <span className={b.date}>{formatDate(post.date)}</span>
      </div>
    </a>
  );
}
