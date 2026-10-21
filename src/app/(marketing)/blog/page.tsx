import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { Band, SectionHead, ShowcaseCta, ShowcaseRoot, ToolHero, ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { finishMetadata } from "@/lib/seo/metadata";
import { BlogCard, formatDate } from "./blog-card";
import { CLUSTERS, clusterOf, postsInCluster } from "./clusters";
import { COVERS } from "./covers";
import { POSTS } from "./posts";
import b from "./blog.module.css";

const TITLE = "UAE Payroll, WPS & Labour Law Blog";
const DESCRIPTION =
  "Practical guidance on UAE WPS payroll, visa and Emirates ID compliance, timesheets, pricing and camps, from the team building ManpowerSync.";
const URL = "https://manpowersync.com/blog";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
});

const accentVars = (slug: (typeof CLUSTERS)[number]["slug"]) => {
  const a = COVERS[slug].accent;
  return { "--x-accent": a.accent, "--x-soft": a.soft, "--x-ink": a.ink, "--x-bright": a.bright } as React.CSSProperties;
};

export default function BlogIndexPage() {
  const latest = [...POSTS].sort((x, y) => y.date.localeCompare(x.date))[0];
  const cover = COVERS[latest.cluster];
  return (
    <ContentShell>
      <ShowcaseRoot accent={ACCENTS.indigo}>
        <ToolHero
          pill="The ManpowerSync blog"
          pillIcon={<BookOpen size={14} aria-hidden />}
          title={
            <>
              UAE payroll and compliance, in <em>plain language</em>
            </>
          }
          lead={DESCRIPTION}
          badges={[`${POSTS.length} guides`, `${CLUSTERS.length} topics`, "Written for labour supply teams"]}
          plain
        />

        <Band>
          <SectionHead eyebrow="Latest" title="Start with the newest guide." />
          <a href={`/blog/${latest.slug}`} className={b.featured} style={accentVars(latest.cluster)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public */}
            <img src={cover.src} width={1200} height={630} alt={cover.alt} fetchPriority="high" decoding="async" />
            <div className={b.featuredBody}>
              <span className={b.tag}>{clusterOf(latest.cluster).label}</span>
              <h2>{latest.title}</h2>
              <p>{latest.description}</p>
              <span className={b.date}>{formatDate(latest.date)}</span>
            </div>
          </a>
        </Band>

        <Band soft>
          <SectionHead eyebrow="Topics" title="Browse by topic." />
          <ul className={b.chips}>
            {CLUSTERS.map((c) => (
              <li key={c.slug}>
                <a className={b.chip} href={`#${c.slug}`} style={accentVars(c.slug)}>
                  {c.label} <span style={{ color: "var(--steel)", fontWeight: 500 }}>· {postsInCluster(c.slug).length}</span>
                </a>
              </li>
            ))}
          </ul>
          {CLUSTERS.map((cluster, i) => (
            <div key={cluster.slug} id={cluster.slug} className={b.topic} style={{ marginTop: i === 0 ? 0 : 64 }}>
              <h2 style={{ margin: "0 0 6px", fontFamily: "var(--font-jakarta), system-ui, sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: -0.6, color: "var(--ink)" }}>
                {cluster.label}
              </h2>
              <p style={{ margin: "0 0 24px", maxWidth: 640, fontSize: 16.5, lineHeight: 1.6, color: "var(--slate)" }}>{cluster.blurb}</p>
              <div className={b.grid}>
                {postsInCluster(cluster.slug).map((post) => (
                  <BlogCard key={post.slug} post={post} />
                ))}
              </div>
              <p className={b.pillars}>
                The product behind this topic:{" "}
                {cluster.pillars.map((p, j) => (
                  <span key={p.href}>
                    {j > 0 && ", "}
                    <a href={p.href}>{p.label}</a>
                  </span>
                ))}
                .
              </p>
            </div>
          ))}
        </Band>

        <ShowcaseCta title="See it on your own numbers." lead="A 30-minute call with your own timesheet workbook is all it takes." />
      </ShowcaseRoot>
    </ContentShell>
  );
}
