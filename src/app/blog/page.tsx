import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { CtaBand, LinkCardGrid, PageHero, Section } from "@/app/welcome/content-blocks";
import { POSTS } from "./posts";

const TITLE = "Blog";
const DESCRIPTION =
  "Practical guidance on UAE WPS payroll, visa and Emirates ID compliance, and running a manpower supply business — from the team building ManpowerSync.";
const URL = "https://manpowersync.com/blog";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AE", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogIndexPage() {
  return (
    <ContentShell>
      <PageHero eyebrow="Blog" title="UAE payroll and compliance, in plain language." lead={DESCRIPTION} />

      <Section eyebrow="Latest" title="Recent posts.">
        <LinkCardGrid
          cards={[...POSTS]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((post) => ({
              href: `/blog/${post.slug}`,
              title: post.title,
              body: post.description,
              meta: formatDate(post.date),
            }))}
        />
      </Section>

      <CtaBand
        title="See it on your own numbers."
        lead="A 30-minute call with your own timesheet workbook is all it takes."
      />
    </ContentShell>
  );
}
