# enigma homepage notes and artwork

Read the root and `src/AGENTS.md` before changing the website. The owner asked
for a native Next.js route in the existing app, rather than a standalone server.

- The running site is http://127.0.0.1:3001/home, started with `npm run dev` from
  the workspace root. `npm run dev:home` is an alias for the same Next.js server.
- Website code is in `src/website/`, with thin routes in
  `src/app/(website)/home/`. This `home/` directory retains documentation and the
  original generated hero artwork only.
- The app package and `.env.local` are at the workspace root. `/admin` is the
  dashboard, with a separate root layout and stylesheet; `/` redirects to it.
  The remaining root `admin/` folder stores private data, not website source.
- Styles are isolated in `home.module.css` and must not affect the dashboard.
- Do not add small eyebrow labels above homepage headings. In-page links scroll
  smoothly with sticky-header clearance; the three-line mobile menu animates to X.
- Reviews use `ReviewMarquee.tsx`: a slow left-to-right loop, paused on hover,
  touch, keyboard focus or the Pause control. Keep duplicated cards inert/hidden
  from assistive technology. Per the owner's request, reduced motion uses a
  gentler loop with Pause still visible; without JavaScript the row is static.
  In-page scroll animation is cancellable by manual input and shorter with
  reduced motion; do not rely only on native browser smooth scrolling.
  Normal loops take 90 seconds; reduced motion uses 150 seconds. The long review
  notice is removed, and per-card sample labels remain at a readable size.
- Experience remains 5+ years web development and 10+ years branding. The third
  item is “Building lasting trust.”; do not sum overlapping experience into 15 years.
- Bilingual copy and approved public brand/contact details live in the feature's
  `content.mjs` and `site.config.mjs`: `enigma`, `nikodola@gmail.com`.
- The owner prioritizes new websites and redesigns. Web design is the first
  service card and enquiry option; keep `serviceIds` aligned with both locales.
  FAQs answer practical buying questions without invented prices or timelines.
  See `CONTENT-AUDIT.md` for the copy review and outstanding proof/launch items.
- The contact endpoint is `/home/contact`, separate from authenticated admin
  mutations. It saves to `admin/.data/home-inquiries.sqlite`, never the business
  admin database. No email notifications are connected. Tests use temporary data.
  The contact form has no reply-consent checkbox. Keep historical consent values
  intact and leave the legacy `consent_at` empty for new submissions.
- Portfolio projects are Breeze, GMunchies Vending, Emilija Petrova, T. Hendo and
  Indoor Plants. Project records, supplied live URLs and bilingual drafts live in
  `src/website/portfolio.mjs`. All five reviews remain visibly labelled
  sample drafts; do not invent approved endorsements or ratings. Thumbnails use
  copied existing screenshots/artwork, documented in `design/portfolio-assets.md`.
- Run `npm run test:home` for focused behavior checks and the admin typecheck/build
  for framework changes. Do not open the business dashboard for visual checks.
- Preserve the owner's local-only preference; no Site registration or publication.
  The public homepage permits indexing for local Lighthouse checks. Do not add
  noindex simply because it runs locally; private admin/API/contact routes retain it.
