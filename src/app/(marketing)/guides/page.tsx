import type { Metadata } from "next";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { CtaBand, LinkCardGrid, PageHero, Section } from "@/app/(marketing)/welcome/content-blocks";
import { SITE } from "@/app/(marketing)/welcome/content";
import p from "@/app/(marketing)/welcome/prose.module.css";
import { GUIDES } from "./guides-data";

const TITLE = "Manpower Software How-To Guides";
const DESCRIPTION = `Step-by-step guides to running ${SITE.name} — importing your workforce, running payroll, and setting up your team.`;
const URL = "https://manpowersync.com/guides";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
});

export default function GuidesIndexPage() {
  return (
    <ContentShell>
      <PageHero eyebrow="Guides" title="How to run it, step by step." lead={DESCRIPTION} />

      <Section eyebrow="Getting started" title="Start here.">
        <LinkCardGrid
          cards={GUIDES.map((g) => ({
            href: `/guides/${g.slug}`,
            title: g.title,
            body: g.description,
          }))}
        />
      </Section>

      <Section surface eyebrow="Also useful" title="Reading, rather than how-to.">
        <LinkCardGrid
          columns={3}
          cards={[
            { href: "/blog", title: "Blog", body: "UAE payroll and compliance reading — WPS rejections, gratuity, overtime rules and expiry tracking." },
            { href: "/faq", title: "FAQ", body: "The short answers: getting started, timesheets, payroll and WPS, security, subcontractors." },
            { href: "/features", title: "Features", body: "Every module in one place, from timesheets through to letters, NOCs and the audit trail." },
          ]}
        />
      </Section>

      <Section eyebrow="Before you start" title="How the guides are organised.">
        <div className={p.prose}>
          <p>
            Each guide follows one job from start to finish, in the order you would do it: what you need ready, the
            steps, and what to check before you move on. They assume you are signed in with the right
            permissions.
          </p>
          <ul>
            <li>
              <strong>Getting your workforce in.</strong> Import employees and sites from your existing sheets, then
              upload your timesheet workbook as it is. This is the first guide to read.
            </li>
            <li>
              <strong>Running payroll.</strong> From approved hours to a payroll run, the approval step, and exporting the
              WPS file for your bank or exchange house.
            </li>
            <li>
              <strong>Setting up your team.</strong> Roles and permissions, so supervisors, finance and HR each see only
              what they should.
            </li>
          </ul>
          <p>
            If you would rather read about the rules behind the screens, the{" "}
            <a href="/blog/wps-sif-rejection-reasons-uae">WPS rejection guide</a> and the{" "}
            <a href="/blog/visa-emirates-id-expiry-compliance-checklist">expiry checklist</a> explain the UAE side, and the
            free <a href="/tools">tools</a> let you try a calculation or check a file with nothing to install.
          </p>
        </div>
      </Section>

      <CtaBand
        title="Rather be walked through it?"
        lead="A 30-minute call with your own timesheet workbook beats any guide."
      />
    </ContentShell>
  );
}
