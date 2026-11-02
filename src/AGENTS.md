<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shared root application

The Next.js package, configuration, dependencies and `.env.local` live in the
workspace root. Run `npm run dev`, `npm run typecheck`, `npm test` and `npm run build`
there. Installed framework docs are in `../node_modules/next/dist/docs/` relative
to this file. Do not create a second `src/pages` router or a new homepage server.

- `app/(website)/` and `app/(workspace)/` have separate root HTML layouts. Keep
  public and admin styles, metadata and error UI separate. Crossing root layouts
  performs a full document navigation; there is intentionally no `app/layout.tsx`.
- `/home`, `/home/en`, `/home/mk` and `/home/contact` retain their URLs. `/admin`
  hosts the dashboard; `/` redirects there with the old `?view=` query preserved.
- `admin/components/` is dashboard UI; `admin/server/` is authentication/storage.
  Keep owner verification and mutation-origin checks on every private API path.
- `website/` contains public content/components/styles. `shared/` contains shared
  platform modules; `shared/server/` is Node-only and must not enter client code.
- Private data stays in root `admin/.data/`. The source folder `src/admin/` is
  distinct from that storage folder. Do not relocate or seed records as part of
  source changes. Relative database/Marketing path overrides retain their old
  meaning relative to the storage `admin/` directory.
- API routes remain `/api/*`; Worker source/migrations live in root `workers/api`.
  Tests use temporary storage. Do not visually inspect the owner's dashboard.
- Use `npm run dev` for the shared port-3001 local app. Production `next start`
  intentionally disables local admin access; use another port for temporary
  production audits and keep the owner's local server in development mode.

## Studio homepage

The owner requested the enigma website in this existing Next.js app at `/home`,
with explicit `/home/en` and `/home/mk` language routes. It is local-only for now.
Thin routes live in `src/app/(website)/home/`; React components, public configuration and
copy live in `src/website/`. Keep its CSS Module scoped to the page wrapper
so dashboard styles are unaffected. Public assets are in `public/home/`.
`portfolio.mjs` holds Breeze, GMunchies Vending, Emilija Petrova, T. Hendo and
Indoor Plants with supplied live links. Existing project screenshots/artwork are
copied to `public/home/portfolio/`; see `../home/design/portfolio-assets.md`.
Every project review is visibly labelled sample draft wording, not approved feedback.
The homepage omits eyebrow labels. Its three-line menu animates to an X and
in-page contact links scroll smoothly. `ReviewMarquee.tsx` shows review cards
moving left to right, paused on hover/touch/focus or by the Pause control. Keep
the duplicate group inert and hidden from assistive technology. The owner wants
the loop active even with reduced motion: use a gentler speed and keep Pause
visible. Link scrolling uses requestAnimationFrame (native smooth scrolling can
jump when OS animations are disabled), with a shorter reduced-motion duration
and cancellation on manual scroll input. Without JS, reviews remain a static row.
The loop takes 90 seconds normally and 150 with reduced motion. Sample labels
remain on individual cards; the long section notice was removed at the owner's
request. Font sizes outside the decorative Breeze mockup are at least 12px.
Fonts are self-hosted through next/font; hero/portfolio images use next/image.
Public homepage metadata allows `index, follow`; its responses have no noindex
header. The owner wants complete local Lighthouse checks. Local-only means no
deployment, not noindex. Keep private workspace/API/contact responses noindex.
New websites and redesigns are the primary offer. The first service card and
first enquiry option are `website`; `content.mjs` keeps their order aligned.
Five native FAQ disclosures cover price, redesigns, branding, timing and care.
Keep public claims grounded; see `../home/CONTENT-AUDIT.md` for remaining gaps.

The contact form posts to `/home/contact`, validates its own same-origin public
request, and stores messages in `admin/.data/home-inquiries.sqlite` (or the explicit
persistent `HOME_INQUIRIES_DATA_PATH` in production). It does not use the admin
database, authenticated CRUD API, Stripe or email delivery.
There is no reply-consent checkbox or validator requirement. Preserve historical
`consent_at` values, but leave that legacy column empty for new inquiries.
Preserve all existing admin owner authentication and mutation checks.
`npm run test:home` runs focused
tests using temporary data. See `../home/README.md` for language and inbox setup.
