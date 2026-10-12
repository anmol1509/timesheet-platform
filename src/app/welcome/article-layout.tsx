import { CtaBand, PageHero } from "./content-blocks";
import s from "./welcome.module.css";

/** Shared article chrome for blog posts and guides — a proper hero rather
 * than a bare heading, and prose styled from the same tokens as the rest of
 * the site instead of a separate grey-on-white treatment. */
export function ArticleLayout({
  eyebrow,
  title,
  lead,
  backHref,
  backLabel,
  ctaTitle,
  ctaLead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  backHref: string;
  backLabel: string;
  ctaTitle: string;
  ctaLead: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} lead={lead} cta={false} />

      <section className={s.section}>
        <div className={s.container}>
          <article
            style={{ maxWidth: 720, margin: "0 auto" }}
            className={[
              "text-[17px] leading-[1.7] text-[var(--charcoal)]",
              "[&>p]:my-5",
              "[&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:text-[clamp(24px,3vw,30px)] [&_h2]:font-semibold [&_h2]:leading-[1.25] [&_h2]:tracking-[-0.4px] [&_h2]:text-[var(--ink)]",
              "[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-[19px] [&_h3]:font-semibold [&_h3]:text-[var(--ink)]",
              "[&_ul]:my-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6",
              "[&_ol]:my-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6",
              "[&_li]:text-[var(--slate)]",
              "[&>p]:text-[var(--slate)]",
              "[&_strong]:font-semibold [&_strong]:text-[var(--ink)]",
              "[&_a]:font-medium [&_a]:text-[var(--primary)] [&_a]:underline [&_a]:underline-offset-2",
              "[&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[15px]",
              "[&_th]:border-b [&_th]:border-[var(--line,#e5e7eb)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[var(--ink)]",
              "[&_td]:border-b [&_td]:border-[var(--line,#e5e7eb)] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-[var(--slate)]",
            ].join(" ")}
          >
            {children}
          </article>

          <p style={{ maxWidth: 720, margin: "48px auto 0" }}>
            <a href={backHref} className={s.linkish} style={{ fontWeight: 500 }}>
              &larr; {backLabel}
            </a>
          </p>
        </div>
      </section>

      <CtaBand title={ctaTitle} lead={ctaLead} />
    </>
  );
}
