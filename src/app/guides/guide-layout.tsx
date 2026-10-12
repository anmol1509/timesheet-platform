import { ArticleLayout } from "@/app/welcome/article-layout";
import type { Guide } from "./guides-data";

export function GuideLayout({ guide, children }: { guide: Guide; children: React.ReactNode }) {
  return (
    <ArticleLayout
      eyebrow="Guide"
      title={guide.title}
      lead={guide.description}
      backHref="/guides"
      backLabel="All guides"
      ctaTitle="Rather be walked through it?"
      ctaLead="A 30-minute call with your own workbook beats any guide."
    >
      {children}
    </ArticleLayout>
  );
}
