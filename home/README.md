# enigma homepage

The studio website is a native React/Next.js page in the root application.
This directory retains documentation and the original hero artwork. There is no
separate homepage server, Python application or dependency installation.

From the workspace root:

```powershell
npm run dev
```

- Automatic language: http://127.0.0.1:3001/home
- English: http://127.0.0.1:3001/home/en
- Macedonian: http://127.0.0.1:3001/home/mk

`npm run dev:home` starts the same Next.js server on port 3001. The business admin
is at `/admin`; `/` redirects there with the old dashboard tab preserved. Its
owner authentication and mutation checks remain in place. Public and admin routes
have separate root layouts, styles and error boundaries. The website is local-only
for now. Its public pages permit indexing so Lighthouse can assess SEO locally;
the admin, private API and contact endpoint retain noindex. Local-only means no
deployment, and does not require a search-engine block. `.env.local` is at the
workspace root.

## Code

| Location | Purpose |
| --- | --- |
| `src/app/(website)/layout.tsx` | Public root layout, separate from the dashboard |
| `src/app/(website)/error.tsx` | Public error UI |
| `src/website/website.css` | Public document defaults without admin styling |
| `src/app/(website)/home/page.tsx` | Automatic language route |
| `src/app/(website)/home/[locale]/page.tsx` | Explicit English/Macedonian routes |
| `src/app/(website)/home/contact/route.ts` | Public contact POST handler |
| `src/website/HomePage.tsx` | Server-rendered React page sections |
| `src/website/HomeInteractions.tsx` | React navigation, map and form |
| `src/website/PortfolioSection.tsx` | Project thumbnail cards and review data adapter |
| `src/website/ReviewMarquee.tsx` | Slowly moving client review cards and pause controls |
| `src/website/portfolio.mjs` | Five project links, bilingual summaries and review drafts |
| `src/website/content.mjs` | Complete English/Macedonian copy |
| `src/website/site.config.mjs` | enigma, nikodola@gmail.com and project link |
| `src/website/home.module.css` | Scoped responsive homepage styles |
| `src/shared/home-locale.mjs` | Language selection and trusted country handling |
| `src/shared/home-contact*.mjs` | Validation, inbox and contact request handling |
| `public/home/` | Generated hero, Breeze preview assets and favicon |

The page includes service cards, the Breeze portfolio feature, GMunchies Vending,
Emilija Petrova, T. Hendo and Indoor Plants portfolio cards, SEO foundations,
5+ years in web development and 10+ years in branding, a Bitola map and a contact
form. Each project has a sample review draft, labelled in both languages, that
needs client approval before it can be presented as a real endorsement. The Breeze preview
uses copied public assets without changing the client project. The interactive
OpenStreetMap loads on request. Next.js self-hosts the website fonts with system
fallbacks; visitors make no Google Fonts requests. Responsive Next.js images
deliver appropriately sized hero and portfolio assets.

Project thumbnails link directly to the owner's supplied live URLs in new tabs.
They use existing project screenshots and public artwork from the `Junk code`
folders; the source projects are unchanged. See [thumbnail provenance](design/portfolio-assets.md).

Heading eyebrow labels are intentionally omitted. The mobile menu has three
lines that animate into an X. In-page links, including the contact buttons,
smoothly scroll with clearance for the sticky header. The animation is controlled
with requestAnimationFrame so browser/OS settings cannot silently turn it into a
jump; manual wheel, touch, pointer and scroll-key input cancel it. Reduced motion
uses a shorter 450ms transition. The third experience item
reads “Building lasting trust.”; the numeric claims remain 5+ years for web
development and 10+ years for branding.

Review cards show each project/client name with a quoted message. They move
slowly from left to right in a seamless loop, pause on mouse hover, finger contact
or keyboard focus, and have a persistent Pause / Play control. The duplicated
visual group is hidden from assistive technology. Per the owner's explicit motion
request, the loop runs continuously: 90 seconds per cycle normally and a gentler
150 seconds with reduced motion. Pause / Play remains available in both modes.
Without JavaScript, the reviews are a static horizontally scrollable row.
All review wording remains visibly labelled as sample drafts awaiting approval.

The main offer is new websites and redesigns for small businesses and independent
professionals. Branding and maintenance support that offer. Both languages have
specific service/project descriptions, an enquiry process and five native FAQ
disclosures about cost, redesigns, existing branding, timing and ongoing support.
Their answers work without JavaScript. Prices and delivery windows are not
invented. See [the content and SEO review](CONTENT-AUDIT.md) for remaining needs,
including real testimonials, a case study, public identity and launch configuration.

## Language selection

An explicit `/home/mk` or `/home/en` URL wins. The switcher remembers a manual
choice in a cookie scoped to `/home`. On `/home`, a configured trusted edge country
selects Macedonian for `MK` and English for every other known country. When no
country information is available, the preferred browser language is used.
No precise-location permission or third-party IP lookup is involved.

Localhost does not know the visitor's country. For a local geographic preview,
set `HOME_DEV_COUNTRY=MK` or `US` in `.env.local` and visit `/home` without
a saved language cookie. Never overwrite existing environment configuration.

For future hosting, `HOME_TRUST_COUNTRY_HEADER=true` permits the trusted header
configured by `HOME_COUNTRY_HEADER` (`cf-ipcountry` or `x-vercel-ip-country`).
Only enable behind an edge that overwrites country/client-IP headers and blocks
direct origin bypass. Client-IP information is used transiently for rate limiting
and is not stored with enquiries. These settings are independent of admin auth.

## Contact inbox

The form posts to the Next.js route `/home/contact` and saves enquiries to
`admin/.data/home-inquiries.sqlite`, separate from the business database.
It stores contact details, message, service, language and submission timestamp.
An optional bilingual referral-code field is prefilled by Marketing's QR links.
Active codes resolve privately on the server and save the referring partner's
ID/name/code snapshot with the enquiry. Those enquiries appear in the private
Referral Program and inbox CLI. Language changes preserve the current URL code.
No commission is created until the owner records a qualifying payment. See
[`docs/REFERRALS.md`](../docs/REFERRALS.md) before printing or distributing QR flyers.
There is no reply-consent checkbox. The legacy `consent_at` storage column is
preserved for earlier inquiries and left empty on new submissions.
Origin validation, bounded bodies, a honeypot and rate limits protect the endpoint.
The form also works with JavaScript disabled. No inbox data is publicly served.

Read messages with `npm run home:inbox` from the workspace root.
`npm run home:inbox -- --json` prints a private export. Keep exports and backups
private. Use a SQLite-aware backup or stop the server before copying the database.

The email link opens the visitor's mail app. The contact form saves messages but
does not send email notifications; a mail delivery provider is still needed for
that. Production submissions require `HOME_PUBLIC_ORIGIN` (the exact HTTPS
origin) and absolute `HOME_INQUIRIES_DATA_PATH` on persistent Node storage.
Do not rely on an ephemeral deployment filesystem for inbox persistence.

## Verification

```powershell
npm run test:home
npm run typecheck
npm run build
```

Tests use mock inboxes and temporary databases, never the owner's business data.
The earlier standalone port-3002 server and static export were removed when the
site was moved into Next.js. `scripts/new-site.mjs` is the existing JavaScript
client-project generator and is unrelated to this homepage route.
