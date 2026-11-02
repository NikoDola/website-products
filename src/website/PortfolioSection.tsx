import { portfolio } from "./portfolio.mjs";
import { Arrow } from "./Icons";
import type { HomeCopy, HomeLocale } from "./types";
import ReviewMarquee from "./ReviewMarquee";
import Image from "next/image";

export function PortfolioGallery({ t, locale }: { t: HomeCopy; locale: HomeLocale }) {
  return <div className="portfolio-grid">
    {portfolio.filter((project) => !project.featured && project.thumbnail).map((project) => <article className="portfolio-card" key={project.id} data-project={project.id}>
      <a className={`portfolio-thumbnail ${project.thumbnail!.fit === "contain" ? "thumbnail-contain" : ""}`} href={project.url} target="_blank" rel="noopener noreferrer" aria-label={`${t.visit} — ${project.name[locale]}`}>
        <Image src={project.thumbnail!.src} alt={project.imageAlt![locale]} width={project.thumbnail!.width} height={project.thumbnail!.height} sizes="(max-width: 680px) calc(100vw - 40px), (max-width: 1304px) calc((100vw - 132px) / 2), 586px" loading="lazy" />
        <span className="portfolio-open" aria-hidden="true"><Arrow /></span>
      </a>
      <div className="portfolio-card-body"><h3><a href={project.url} target="_blank" rel="noopener noreferrer">{project.name[locale]}</a></h3><p className="portfolio-description">{project.description![locale]}</p><ul className="project-tags">{project.tags![locale].map((tag) => <li key={tag}>{tag}</li>)}</ul>
        <a className="portfolio-visit text-link" href={project.url} target="_blank" rel="noopener noreferrer">{t.visit} <Arrow /></a>
      </div>
    </article>)}
  </div>;
}

export function PortfolioReviews({ t, locale }: { t: HomeCopy; locale: HomeLocale }) {
  return <ReviewMarquee title={t.reviewTitle} badge={t.reviewBadge} pauseLabel={t.reviewPause} resumeLabel={t.reviewResume}
    reviews={portfolio.map((project) => ({ id: project.id, name: project.name[locale], message: locale === "mk" ? `„${project.review.mk}“` : `“${project.review.en}”` }))} />;
}
