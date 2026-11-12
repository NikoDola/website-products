import { Fragment } from "react";
import Image from "next/image";
import { content, serviceIds } from "./content.mjs";
import { site } from "./site.config.mjs";
import { Arrow, Pin, ServiceIcon } from "./Icons";
import { HomeShell, HomeHeader, HomeMap, HomeContactForm, ServiceLink } from "./HomeInteractions";
import type { HomeLocale } from "./types";
import { PortfolioGallery, PortfolioReviews } from "./PortfolioSection";
import { referralCode, validReferralCode } from '../shared/referrals.mjs';

function Lines({ children }: { children: string }) {
  return children.split("\n").map((line, index) => <Fragment key={index}>{index > 0 && <br />}{line}</Fragment>);
}

export default function HomePage({ locale, sent = false, error, referral: rawReferral }: { locale: HomeLocale; sent?: boolean; error?: string; referral?: string }) {
  const t = content[locale];
  const code = referralCode(rawReferral), referral = validReferralCode(code) ? code : '';
  // The map marks the city; no exact business address has been supplied.
  const schema = { "@context": "https://schema.org", "@type": "ProfessionalService", name: site.name, description: t.description, email: site.email, address: { "@type": "PostalAddress", addressLocality: "Bitola", addressCountry: "MK" }, areaServed: ["North Macedonia", "Worldwide"], knowsLanguage: ["mk", "en"] };
  return <HomeShell locale={locale}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <a className="skip-link" href="#home-main">{t.skip}</a><HomeHeader t={t} locale={locale} referral={referral} />
    <main id="home-main">
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy"><h1 id="hero-title">{t.hero[0]}<br />{t.hero[1]}<br /><span className="serif">{t.hero[2]}</span></h1><p className="hero-intro">{t.intro}</p><div className="hero-actions"><a className="button" href="#contact">{t.start} <Arrow /></a><a className="text-link" href="#work">{t.explore}<span aria-hidden="true">↓</span></a></div><div className="hero-location"><Pin /><div>{t.location}<small>{t.worldwide}</small></div></div></div>
        <figure className="hero-art"><div className="art-label"><span className="mini-mark" aria-hidden="true">✳</span><span><Lines>{t.artLabel}</Lines></span></div><Image src="/home/assets/studio-hero.webp" alt={t.imageAlt} width={880} height={800} sizes="(max-width: 680px) calc(100vw - 40px), (max-width: 1304px) 45vw, 575px" fetchPriority="high" loading="eager" /><figcaption><span>{t.imageCaption}</span><span aria-hidden="true">↗</span></figcaption></figure>
      </section>
      <div className="container experience-strip">{t.experience.map(([number, label]) => <div key={number} className="experience-item"><strong>{number}</strong><span>{label}</span></div>)}<div className="experience-trust"><strong>{t.trustTitle}</strong><span>{t.trustText}</span></div><span className="experience-flower" aria-hidden="true">✳</span></div>
      <section className="section services-section" id="services"><div className="container"><div className="section-heading"><div><h2><Lines>{t.servicesTitle}</Lines></h2></div><p className="section-intro">{t.servicesIntro}</p></div>
        <div className="services-grid">{t.services.map((service, i) => <article key={service.icon} className="service-card"><div className="service-top"><ServiceIcon icon={service.icon} /><span>0{i + 1}</span></div><h3>{service.title}</h3><p>{service.text}</p><ul>{service.items.map((item) => <li key={item}>{item}</li>)}</ul><ServiceLink id={serviceIds[i]}>{t.talk} <Arrow /></ServiceLink></article>)}</div>
      </div></section>
      <section className="section work-section container" id="work"><div className="section-heading"><div><h2><Lines>{t.workTitle}</Lines></h2></div><p className="section-intro">{t.workIntro}</p></div>
        <article className="project"><div className="project-visual"><span className="project-stamp">{t.projectLabel}<span aria-hidden="true">↗</span></span>
          <a className="browser-mockup" href={site.portfolioUrl} target="_blank" rel="noopener noreferrer" ><div className="browser-mockup-art" role="img" aria-label={`${t.visit} - Breeze Heating & Cooling`}><div className="browser-bar" aria-hidden="true"><span className="browser-dots"><i /><i /><i /></span><span>breeze-full.vercel.app</span><span aria-hidden="true">↗</span></div><div className="breeze-nav" aria-hidden="true"><img src="/home/assets/breeze-logo.svg" width={211} height={41} alt="Breeze Heating & Cooling" /><span>HEATING &nbsp; COOLING &nbsp; ABOUT US</span><b>Request service ↗</b></div><div className="breeze-preview" aria-hidden="true"><Image src="/home/assets/breeze-hero.webp" width={1672} height={838} alt="" sizes="(max-width: 680px) calc(100vw - 70px), (max-width: 1304px) calc(100vw - 224px), 1080px" loading="lazy" /><div className="breeze-copy"><span>YOUR COMFORT. OUR PRIORITY.</span><h3>Home feels<br /><em>better</em> with a<br />little Breeze<span>.</span></h3><span className="breeze-button">Let’s get comfortable ↗</span></div></div></div></a><span className="mockup-note">{t.mockupLabel}</span>
        </div><div className="project-details"><div><h3>{t.projectTitle}</h3><p>{t.projectText}</p><ul className="project-tags">{t.projectTags.map((tag) => <li key={tag}>{tag}</li>)}</ul></div><a className="round-link" href={site.portfolioUrl} target="_blank" rel="noopener noreferrer" aria-label={t.visit}><Arrow /></a></div></article>
        <PortfolioGallery t={t} locale={locale} />
      </section>
      <section className="seo-section"><div className="container seo-grid"><div><h2><Lines>{t.seoTitle}</Lines></h2><p className="seo-intro">{t.seoText}</p><p className="seo-note">{t.seoNote}</p></div><div className="seo-points">{t.seoItems.map(([title, text], i) => <div key={title} className="seo-point"><span className="check-icon" aria-hidden="true">✓</span><div><h3>{title}</h3><p>{text}</p></div><span className="point-number" aria-hidden="true">0{i + 1}</span></div>)}</div></div></section>
      <section className="section container about-section" id="about"><div className="about-grid"><div><h2><Lines>{t.aboutTitle}</Lines></h2></div><div className="about-copy"><p>{t.aboutText}</p><p>{t.aboutSecond}</p></div></div><div className="process-grid">{t.process.map(([number, title, text]) => <article key={number}><span className="process-number">{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <PortfolioReviews t={t} locale={locale} />
      <section className="section container location-section"><div className="location-copy"><h2><Lines>{t.mapTitle}</Lines></h2><p>{t.mapText}</p><a className="text-link" href="https://www.openstreetmap.org/?mlat=41.0314&mlon=21.3347#map=13/41.0314/21.3347" target="_blank" rel="noopener noreferrer">{t.mapLink} <Arrow /></a></div><HomeMap t={t} /></section>
      <section className="section container faq-section" id="questions" aria-labelledby="faq-title">
        <div className="faq-heading"><h2 id="faq-title">{t.faqTitle}</h2><p>{t.faqIntro}</p></div>
        <div className="faq-list">{t.faqs.map(([question, answer]) => <details key={question}><summary>{question}<span className="faq-toggle" aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
      </section>
      <section className="contact-section" id="contact"><div className="container contact-grid"><div className="contact-copy"><h2><Lines>{t.contactTitle}</Lines></h2><p>{t.contactText}</p><div className="contact-flower" aria-hidden="true">✳</div><p className="contact-note">{t.contactNote}</p><a className="text-link" href={`mailto:${site.email}`}>{t.emailLink} <Arrow /></a></div><HomeContactForm t={t} locale={locale} sent={sent} initialError={error} referral={referral} /></div></section>
    </main>
    <footer className="container site-footer"><div><a className="footer-name" href="#top">{site.name}<span>.</span></a><p>{t.footerTagline}</p></div><div className="footer-end"><p>© {new Date().getFullYear()} {site.name}. {t.rights}</p><a href="#top">{t.backTop} ↑</a></div></footer>
  </HomeShell>;
}
