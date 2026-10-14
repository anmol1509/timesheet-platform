import type { Metadata } from "next";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { CtaBand, LinkCardGrid, PageHero, Section } from "@/app/(marketing)/welcome/content-blocks";
import { finishMetadata } from "@/lib/seo/metadata";
import { CLUSTERS, postsInCluster } from "./clusters";

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AE", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogIndexPage() {
  return (
    <ContentShell>
      <PageHero eyebrow="Blog" title="UAE payroll and compliance, in plain language." lead={DESCRIPTION} />

      {CLUSTERS.map((cluster, i) => (
        <Section key={cluster.slug} surface={i % 2 === 1} eyebrow="Topic" title={cluster.label} lead={cluster.blurb}>
          <LinkCardGrid
            cards={postsInCluster(cluster.slug).map((post) => ({
              href: `/blog/${post.slug}`,
              title: post.title,
              body: post.description,
              meta: formatDate(post.date),
            }))}
          />
          <p style={{ marginTop: 20, fontSize: 15, color: "var(--steel)" }}>
            The product behind this topic:{" "}
            {cluster.pillars.map((p, j) => (
              <span key={p.href}>
                {j > 0 && ", "}
                <a href={p.href} style={{ color: "var(--primary)", fontWeight: 500 }}>{p.label}</a>
              </span>
            ))}
            .
          </p>
        </Section>
      ))}

      <CtaBand
        title="See it on your own numbers."
        lead="A 30-minute call with your own timesheet workbook is all it takes."
      />
    </ContentShell>
  );
}
