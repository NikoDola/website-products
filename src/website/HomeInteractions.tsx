"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { Arrow, Pin } from "./Icons";
import { site } from "./site.config.mjs";
import { serviceIds } from "./content.mjs";
import type { HomeCopy, HomeLocale } from "./types";
import styles from "./home.module.css";

export function HomeShell({ locale, children }: { locale: HomeLocale; children: ReactNode }) {
  const [enhanced, setEnhanced] = useState(false);
  const scrollFrame = useRef<number | null>(null);
  useEffect(() => {
    setEnhanced(true);
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    function cancelScroll() {
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = null;
    }
    function cancelOnKey(event: KeyboardEvent) {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Escape", "Tab"].includes(event.key)) cancelScroll();
    }
    window.addEventListener("wheel", cancelScroll, { passive: true });
    window.addEventListener("touchstart", cancelScroll, { passive: true });
    window.addEventListener("pointerdown", cancelScroll, { passive: true });
    window.addEventListener("keydown", cancelOnKey);
    window.addEventListener("popstate", cancelScroll);
    return () => {
      cancelScroll();
      document.documentElement.lang = previous;
      window.removeEventListener("wheel", cancelScroll);
      window.removeEventListener("touchstart", cancelScroll);
      window.removeEventListener("pointerdown", cancelScroll);
      window.removeEventListener("keydown", cancelOnKey);
      window.removeEventListener("popstate", cancelScroll);
    };
  }, [locale]);
  function scrollToSection(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
    if (!link || link.classList.contains("skip-link") || link.target === "_blank" || link.hasAttribute("download")) return;
    const hash = link.getAttribute("href");
    if (!hash || hash === "#") return;
    let target: HTMLElement | null;
    try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return; }
    const root = event.currentTarget;
    if (!target || !root.contains(target)) return;
    event.preventDefault();
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    if (location.hash !== hash) history.pushState(history.state, "", hash);
    // Wait for a mobile menu close to commit before measuring the sticky header.
    scrollFrame.current = requestAnimationFrame((startedAt) => {
      const offset = (root.querySelector(".site-header")?.getBoundingClientRect().height || 0) + 16;
      const start = window.scrollY;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const destination = Math.min(maxScroll, Math.max(0, target.getBoundingClientRect().top + start - offset));
      const distance = destination - start;
      const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 450 : Math.min(1300, Math.max(650, Math.abs(distance) * .2));
      // Native "smooth" can still jump when browser/OS animations are disabled.
      // Animate explicitly, while letting wheel, touch and keyboard input interrupt.
      function step(now: number) {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        window.scrollTo({ top: start + distance * eased, behavior: "instant" });
        scrollFrame.current = progress < 1 ? requestAnimationFrame(step) : null;
      }
      step(startedAt);
    });
  }
  return <div id="top" className={styles.site} lang={locale} data-enhanced={enhanced} onClick={scrollToSection}>{children}</div>;
}

export function HomeHeader({ t, locale }: { t: HomeCopy; locale: HomeLocale }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const links = ["services", "work", "about", "contact"];
  function language(event: MouseEvent<HTMLAnchorElement>, next: HomeLocale) {
    document.cookie = `site_language=${next}; Max-Age=31536000; Path=/home; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    event.currentTarget.href = `/home/${next}${location.hash}`;
  }
  return <header className="site-header"><div className="container header-inner" onKeyDown={(event) => { if (event.key === "Escape" && open) { setOpen(false); button.current?.focus(); } }}>
    <a className="wordmark" href={`/home/${locale}`} aria-label={site.name}><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>{site.name}<span className="brand-dot">.</span></span></a>
    <nav id="home-navigation" className={open ? "is-open" : undefined} aria-label={locale === "mk" ? "Главна навигација" : "Main navigation"}>
      {links.map((id, i) => <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>{t.nav[i]}</a>)}
    </nav>
    <div className="header-actions"><div className="language-switch" aria-label={locale === "mk" ? "Јазик" : "Language"}>
      <a href="/home/mk" lang="mk" aria-current={locale === "mk" ? "true" : undefined} onClick={(event) => language(event, "mk")}>МК</a><span aria-hidden="true">/</span>
      <a href="/home/en" lang="en" aria-current={locale === "en" ? "true" : undefined} onClick={(event) => language(event, "en")}>EN</a>
    </div><a className="button button-small header-cta" href="#contact">{t.talk} <Arrow /></a>
      <button ref={button} className="menu-toggle" aria-controls="home-navigation" aria-expanded={open} aria-label={open ? t.closeMenu : t.menu} onClick={() => setOpen(!open)}><span /><span /><span /></button>
    </div>
  </div></header>;
}

export function HomeMap({ t }: { t: HomeCopy }) {
  const [loaded, setLoaded] = useState(false);
  return <div className="map-panel">
    {loaded ? <iframe title={t.mapTitleAttr} src="https://www.openstreetmap.org/export/embed.html?bbox=21.288%2C41.005%2C21.382%2C41.056&layer=mapnik&marker=41.0314%2C21.3347" loading="lazy" referrerPolicy="no-referrer" /> : <>
      <div className="map-pattern" aria-hidden="true"><span className="map-road road-one" /><span className="map-road road-two" /><span className="map-road road-three" /><span className="map-river" /></div>
      <div className="map-center"><Pin /><strong>{t.mapCity}</strong><span>{t.country}</span></div>
      <div className="map-controls"><button className="map-load" onClick={() => setLoaded(true)}>{t.mapLoad} <Arrow /></button><small>{t.mapHint}</small></div>
    </>}
  </div>;
}

export function HomeContactForm({ t, locale, sent, initialError }: { t: HomeCopy; locale: HomeLocale; sent: boolean; initialError?: string }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(sent ? t.success : initialError === "rate" ? t.rate : initialError === "invalid" ? t.invalid : initialError ? t.error : "");
  const [success, setSuccess] = useState(sent);
  const status = useRef<HTMLParagraphElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setBusy(true); setFeedback(""); setSuccess(false);
    try {
      const response = await fetch("/home/contact", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      if (response.ok) { setFeedback(t.success); setSuccess(true); form.reset(); }
      else setFeedback(response.status === 429 ? t.rate : response.status === 400 ? t.invalid : t.error);
    } catch { setFeedback(t.error); }
    finally { setBusy(false); requestAnimationFrame(() => status.current?.focus()); }
  }
  return <form id="contact-form" action="/home/contact" method="post" onSubmit={submit}>
    <input type="hidden" name="locale" value={locale} />
    <div className="honeypot" aria-hidden="true"><label htmlFor="company-url">Website URL</label><input id="company-url" name="company_url" type="text" tabIndex={-1} autoComplete="off" /></div>
    <div className="form-row">
      <label htmlFor="home-name">{t.name}<input id="home-name" name="name" placeholder={t.namePlaceholder} autoComplete="name" required minLength={2} maxLength={120} /></label>
      <label htmlFor="home-email">{t.email}<input type="email" id="home-email" name="email" placeholder={t.emailPlaceholder} autoComplete="email" required maxLength={254} /></label>
    </div>
    <label htmlFor="home-service">{t.service}<select id="home-service" name="service" defaultValue="" required><option value="">{t.servicePlaceholder}</option>{t.serviceOptions.map((name, i) => <option key={serviceIds[i]} value={serviceIds[i]}>{name}</option>)}</select></label>
    <label htmlFor="home-message">{t.message}<textarea id="home-message" name="message" rows={4} placeholder={t.messagePlaceholder} minLength={10} maxLength={5000} required /></label>
    <p className="privacy-note">{t.privacy}</p><button type="submit" className="button form-submit" disabled={busy}><span>{busy ? t.sending : t.send}</span><Arrow /></button>
    <p ref={status} className={`form-status${feedback ? success ? " success" : " error" : ""}`} role="status" aria-live="polite" tabIndex={-1}>{feedback}</p>
  </form>;
}

export function ServiceLink({ id, children }: { id: string; children: ReactNode }) {
  return <a href="#contact" className="service-link" onClick={() => { const select = document.querySelector<HTMLSelectElement>("#home-service"); if (select) select.value = id; }}>{children}</a>;
}
