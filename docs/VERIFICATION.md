# Implementation verification

## 10 November 2026 - client projects grouped under projects/

- Moved the complete Breeze and Extreme Bike Team directories into
  `projects/breeze-web/` and `projects/extreme-bike-team/`. Verified 542 captured
  source/configuration/data files plus Git heads, configuration and worktree
  status before editing paths. Existing Breeze CMS security work was preserved.
- Updated root launch commands, project manifests, documentation, the fresh
  Breeze seed path and the new-site generator. New projects use `projects/<id>-web/`;
  the next available manifest port in this workspace is 3003. The parent Git
  repository ignores project subfolders. No GitHub remote or Vercel root changed.
- Saved a consistent local platform database backup under `backups/`, then
  updated only Breeze's project path using the existing versioned/audited save
  function. Other site fields and business data were retained.
- Root tests: 79 passed, including isolated creation/port/overwrite checks.
  Extreme Bike Team tests: all 6 passed. All three TypeScript checks passed.
  Both client production builds passed from the new folders. Breeze's build
  used command-local CMS enable flags set to false, as in the earlier baseline;
  its font fetch required network access. Environment files were preserved.
- The root type check exposed a malformed generated development route-types
  file. Kept the old generated types in ignored `tmp/`, regenerated with
  `next typegen`, and confirmed the root type check passed.
- Restored the owner's Windows ownership on the moved project/Git directories
  and verified ordinary Git status works in both. No application servers were
  started, no browser inspection was performed, and no changes were pushed or deployed.


## 2 November 2026 - Gmail callback diagnostics and browser binding

- Replaced the generic callback banner with fixed, safe failure categories and
  audit reason codes. Distinguishes denied consent, browser/session problems,
  token/client failures, insufficient permissions, disabled Gmail API and network
  failures. Raw provider details, codes, cookies and tokens remain excluded.
- OAuth start now returns to the configured callback origin before creating any
  state/cookie when initiated on a different supported loopback hostname. The
  owner clicks Connect again on that origin. Old status query parameters are
  removed after the UI displays their result.
- All 78 shared tests, TypeScript and the production build passed. New tests
  verify origin correction without state creation, browser binding, disabled API,
  rejected credentials/codes, scope denial and network failures, including that
  sensitive provider content never appears in user-facing messages.
- The earlier generic failure cannot be diagnosed retrospectively; no successful
  Gmail connection was present at inspection. A fresh owner-driven consent flow
  is needed to verify live authorization. No mail was sent or permission grant
  made by the agent. At the owner's explicit request, the verified port-3001 dev
  process was stopped and the port confirmed free so they can run npm run dev.

## 2 November 2026 - local Gmail connection configuration

- Owner supplied the OAuth client ID and secret in root `.env.local`. Added the
  missing loopback callback URI and a new random encryption key after confirming
  no account credentials were stored. Existing configuration bytes were retained;
  no credential/key values were printed. Configuration validation passed.
- The running port-3001 `/api/outreach` returned 200 and `gmail_configured: true`.
  No accounts were connected yet. The owner can refresh New Clients and use
  Connect sender / Connect test receiver to complete each Google consent flow.
  No emails were sent and no existing business records were changed.

## 2 November 2026 - full Texas selection and messaging parameters

- Texas now uses an always-visible native selection list with search above it.
  The authenticated browse endpoint returns every dataset location alphabetically
  with county, without the existing autocomplete's 30-result cap. Search filters
  locally; clearing it restores the entire list. Native scrolling/keyboard
  selection replaces the previous autocomplete popup.
- Removed manual HVAC company entry from the UI, preserved existing saved leads,
  and added direct Compose email actions on discovered companies. The composer
  shows Email, Caption and Markdown Message in order; Caption remains the actual
  Subject header. Sender selection follows these fields and optional company
  metadata starts collapsed. Pasted bold recipient/caption parameters are split
  out of the message, with a guard against changing an existing recipient.
- Added in-app Gmail setup help and updated the setup guide. The four required
  Gmail/OAuth/encryption values remain missing; no existing environment values
  were changed and no account was connected or message sent.
- All 76 shared tests, TypeScript and the production build passed. New tests
  verify uncapped, ordered, complete location browsing and recipient/caption/body
  separation through MIME output. A read-only local API check returned all 9,591
  locations with private/no-store and noindex headers. Historical Marketing's
  SHA-256 remains unchanged. No dashboard was opened or visually inspected.

## 2 November 2026 - Marketing sections and manual New Clients outreach

- Added authenticated `/admin/marketing/`, `current-clients` and `new-clients`
  pages in the existing dashboard. Legacy `?view=marketing` opens the historical
  directory. Its component, storage/API, filters, exports and edit logic remain
  unchanged. The actual current file contains 173 contacts and 19 contests;
  SHA-256 matched before/after:
  `A4EA304B0797AD29A82A61A2D04E664BB4A8A65629539A752F5F962E3A3EF301`.
- New outreach uses independent SQLite storage, encrypted OAuth credentials,
  manual draft/send/review UI, per-account quotas, send idempotency, uncertain
  outcome reconciliation, evidence-based test mailbox placement, replies/DSNs,
  account pausing and shared suppression. No client/payment conversion occurs.
- Imported 9,591 GeoNames Texas populated places spanning all 254 counties.
  Archive CRC, county crosswalk, unique IDs, coordinate ranges and representative
  city/CDP/village/small-community searches passed. Dataset source hashes and
  attribution are retained. Production file tracing includes the dataset.
  Optional OpenStreetMap discovery is disabled and has mocked API coverage.
- All 74 shared tests, TypeScript and the root production build passed.
  New regressions cover navigation, encrypted storage/redaction, drafts without
  accounts, OAuth state/identity/scopes, encryption-key recovery, concurrent
  limits, dedupe, uncertain sends, test Spam proof, replies, DSNs, disconnects,
  geographic search, safe public contact fields, cache/rate limits and opt-in.
- Isolated HTTP tests on temporary port 3004 used dedicated `tmp/` databases and
  loopback Host headers to exercise the existing local-access gate. Owner/host
  rejection, mutation-origin/request-marker rejection, malformed JSON, no-store,
  draft saves/version conflicts, lead dedupe, suppression, location search,
  missing OAuth setup, disabled discovery and invalid callback rejection passed.
  No dashboard was opened or visually inspected. Test records stayed in temporary
  storage. No Gmail accounts were connected and no real emails were sent. The
  temporary server was stopped, and normal `npm run dev` was started on port 3001.
- Live OAuth/send/Spam tests still require the owner's Google Cloud OAuth client,
  encryption key and account consent. Current implementation setup and limits are
  in `docs/OUTREACH.md`. No paid API, AI agent, deployment, Stripe operation or
  existing business-record mutation was performed.

## 2 November 2026 - restored local admin development mode

- The port-3001 server had been restarted with `next start`. Production mode
  intentionally rejects the localhost owner shortcut, which caused the sign-in
  gate. Stopped that owned process and restored the normal `npm run dev` command.
- HTTP checks on both localhost:3001 and 127.0.0.1:3001 verified the local-owner
  admin page and successful read-only snapshot API, without printing records or
  opening the dashboard visually. The public homepage still permits indexing.
  Production continues to reject the local shortcut; auth code and configuration
  were not changed. No build was needed for this process-mode correction.
- Future production/Lighthouse checks must use a separate temporary port and
  leave the owner's shared local app in development mode on 3001.

## 2 November 2026 - local Lighthouse indexing correction

- Removed the public homepage's noindex metadata/header; local-only development
  does not require them. `/home`, `/home/en` and `/home/mk` now emit index/follow
  metadata and no blocking header. Admin, API and contact responses retain
  noindex. The production API still refuses access without owner configuration.
- Production build/typecheck passed. HTTP checks verified all public language
  routes, protected-route headers and the current port-3001 local preview.
  Fresh local Lighthouse SEO-only reports score 100 on both English/Macedonian,
  including a passing indexing audit. No audits were excluded or altered.
- Current reports: `home/audits/2026-11-02/seo-local-en.html` and
  `seo-local-mk.html`. Earlier reports remain as the record of the original 63.
  Canonical/domain setup and manual structured-data review remain launch tasks.
  Local SEO auditing and actual Google indexing are separate: only the latter
  requires public access. No deployment or configuration-secret change occurred.
- The process on port 3001 was identified as a stale `next start` server. Only
  that verified project process was restarted, using the same command. Fresh
  HTTP checks passed for all three homepage routes. The audit server on port
  3002 was stopped; the corrected preview on port 3001 remains running.

## 2 November 2026 - homepage form, readability and Lighthouse

- Removed the long sample-review paragraph in both languages; individual cards
  retain readable sample labels. Review loops are 90 seconds instead of 110
  (150 instead of 180 with reduced motion); pause controls remain functional.
- Removed the reply-consent checkbox and server validation requirement. New
  inquiries leave the legacy `consent_at` empty; historical values are preserved.
  The privacy note is shorter and readable. Tests use temporary storage/mocks.
- Fixed text contrast and raised small content labels to at least 12px, with
  larger form labels. Decorative Breeze mockup text remains part of a labelled
  graphic. Fonts are self-hosted through next/font with optional display, and
  hero/portfolio assets use responsive next/image delivery.
- Production Lighthouse: English mobile 94/100/100/63, desktop 99/100/100/63,
  Macedonian mobile 94/100/100/63 (performance/accessibility/best practices/SEO).
  SEO's only failed audit is the intentional preview noindex policy. Other
  loading opportunities remain visible in the unmodified reports. This is an
  automated lab audit, not a guarantee of complete accessibility or field speed.
- Both languages also passed axe WCAG 2/2.1 A/AA checks with zero violations.
  Browser QA verified notice/checkbox removal, local font loading, responsive
  layouts, mocked enquiry success and all motion controls. TypeScript, the
  production build and shared tests passed. No real inquiry was submitted.
- Reports and measurement limits: `home/audits/2026-11-02/README.md`. The existing
  dev server was left running; the isolated audit server was stopped afterward.
  No dashboard review, private record changes, environment changes or deployment.

## 1 November 2026 - verified homepage motion repair

- Reproduced the reported contact-link jump in headless Chrome even when the
  browser reported no reduced-motion preference. The former native `smooth`
  call did not animate. Reduced-motion CSS also removed the review animation,
  duplicate cards and Pause/Play button entirely.
- Section links now use a cancellable requestAnimationFrame ease, with sticky
  header clearance measured after closing the mobile menu. Manual wheel, touch,
  pointer, scroll-key input and history navigation cancel an active animation.
  Ordinary transitions take 650-1300ms; reduced-motion transitions take 450ms.
- Per the owner's request for continuous movement, reviews loop left to right
  in both preference modes: 110 seconds per cycle normally, 180 with reduced
  motion. Pause/Play stays visible; hover, held touch and keyboard focus pause
  the track. The visual duplicate remains inert and hidden from accessibility.
  No-JavaScript rendering remains a static, horizontally scrollable row.
- Isolated Chrome browser tests measured intermediate scroll positions and
  correct final offsets for contact/navigation links, manual cancellation,
  positive review movement, all pause/resume controls, infinite iteration and
  a seamless cycle boundary in both motion modes. Mobile Macedonian checks
  verified menu closing, scrolling, real touch hold/release and no page overflow.
  English desktop and Macedonian mobile screenshots were inspected. No browser
  runtime errors occurred. QA scripts/screenshots are in ignored
  `tmp/home-motion-qa/`; Playwright was installed only there.
- TypeScript, all 12 homepage tests and the production build passed. The owner's
  existing port-3001 dev server was reused and left running. No dashboard was
  opened, no valid contact request submitted, and no business data, environment
  settings or deployment changed. This supersedes the static reduced-motion
  behavior and unverified browser behavior described in the earlier entry below.

## 1 November 2026 - shared Next.js app moved to the workspace root

- Root package/config/dependencies now run the existing Next.js app on port 3001.
  Routes are in `src/app`, public source in `src/website`, dashboard UI/server
  code in `src/admin`, shared modules in `src/shared`, and Worker code/migrations
  in `workers/api`. Operations scripts moved to `scripts/platform`; tests to `tests`.
- Public `(website)` and private `(workspace)` route groups have separate root
  layouts, styles, metadata and error boundaries. `/home`, its language routes
  and contact endpoint retain their URLs. Dashboard entry is `/admin`; `/` redirects
  there while preserving the old `?view=` selection. Owner/API checks are retained.
  Noindex remains enabled with separate website-preview and private route policies.
- Existing data stayed in `admin/.data`. A shared path helper preserves defaults
  and the old admin-relative meaning of configured SQLite/Marketing paths.
  Absolute paths are unchanged. Backups remain at root `backups/`. `.env.local`
  moved intact to the root; older `npm --prefix admin run ...` commands forward
  through a small compatibility package. No dependencies were upgraded.
- TypeScript, all 57 shared tests (including two storage-path regression checks),
  the root Next.js production build, local D1 integration test and Worker dry-run
  build passed. Native Worker tools required execution outside the restricted
  sandbox; no Cloudflare deployment or production writes were performed.
- Production HTTP checks verified translated pages, isolated public CSS, one H1,
  five FAQs, existing noindex, public assets, invalid locale rejection, the old-root
  redirect and private API rejection without owner identity. Development HTTP
  checks verified `/admin`, both language pages and invalid/foreign-origin contact
  and admin mutation rejection. No valid test inquiries/business records were sent.
- All five private files and `.env.local` matched pre-move byte fingerprints.
  Core Stripe, platform CRUD, entity, origin-security, communications, router and
  monitoring modules remained byte-identical. No new root `.data` was created.
- Removed only the old generated admin build cache and empty source directory.
  Documentation now uses root commands and current paths; older entries below
  retain their historical paths. Dashboard visual inspection remains with the
  owner. Both temporary QA servers were stopped; port 3001 was verified free.

## 1 November 2026 - homepage marketing copy and SEO review

- Rewrote English and Macedonian copy around the owner-selected primary offer:
  new websites and redesigns. Updated hero, services, project descriptions, SEO
  scope, process, contact prompts, titles and descriptions. Web design is first
  in both service cards and form choices; persisted service IDs are unchanged.
- Added five native FAQ disclosures covering cost, redesigns, existing branding,
  timing and maintenance. CSS stays scoped to the homepage. No prices, delivery
  guarantees, client outcomes or approved testimonials were invented.
- Removed city-centre coordinates from business structured data because no exact
  office location is verified. The Bitola map remains. Local noindex, admin
  protections, live portfolio destinations and sample review labels remain.
- TypeScript, the production build and all 12 existing homepage tests passed.
  HTTP checks returned 200 for both languages and verified one H1, five FAQs,
  translated copy, correctly matched service values/labels, all project links,
  sample-review disclosures, absent eyebrow elements and retained noindex.
- `home/CONTENT-AUDIT.md` records the editorial findings, Google's reference
  guidance, missing real proof and public-launch dependencies. Browser visual
  QA, live ranking/traffic analysis and performance measurement were not performed.
  The existing dev server was reused; no real enquiries/business records, sibling
  projects, environment settings or deployments were changed.

## 1 November 2026 - homepage scrolling, navigation and review cards

- In-page links now use smooth window scrolling with the current sticky-header
  height, measured after the mobile menu closes. Modified/external links and the
  native skip link retain their behavior; reduced motion uses an immediate scroll.
- The mobile button has three lines with a symmetrical animated X state.
  Removed all nine eyebrow labels from the homepage's heading/portfolio markup.
  Replaced the third experience item with bilingual “Building lasting trust” copy;
  the original 5+ web and 10+ branding year figures remain separate.
- Replaced review accordions with client/project cards and quoted messages in a
  slow, seamless left-to-right loop. The visual duplicate is inert and hidden from
  assistive technology. Hover, finger contact, keyboard focus and a Pause/Play
  control stop motion. Reduced motion and no-JavaScript layouts use a static,
  horizontally scrollable row. All reviews remain clearly labelled sample drafts.
- TypeScript and the final production build passed. Local HTTP checks for both
  languages returned 200, confirmed zero heading eyebrow elements, three menu
  lines, ten visual cards with the duplicate group hidden/inert, replacement trust
  copy and removal of the old accordions. Existing local server was reused.
  Browser interaction/visual review remains with the owner; no business data,
  other project files, server configuration or deployments were changed.

## 1 November 2026 - expanded enigma portfolio

- Retained the featured Breeze project and added GMunchies Vending, Emilija
  Petrova, T. Hendo — Dreamstation and Indoor Plants. Thumbnail, title and visit
  links open the owner's supplied live URLs in new tabs. Both languages include
  project summaries and tags. Five native expandable review drafts are labelled
  as samples, with an explicit note that they are not approved client feedback.
- Used existing screenshots and public artwork from the owner's four Junk code
  projects, optimised into local WebP thumbnails totalling approximately 335 KB.
  Original project files were not changed. Provenance and snapshot types are
  documented in `home/design/portfolio-assets.md`.
- TypeScript and the final Next.js production build passed. Local HTTP checks
  returned 200 for English and Macedonian, with four new cards, all five project
  destinations and five review disclosures. All four WebP thumbnail URLs returned
  200. Source checks confirm the stylesheet font import precedes style rules.
- Reused the owner's running development server; no second server, database
  changes, client imports, source-project edits or deployment were performed.
  Browser visual review remains with the owner. Thumbnails are saved screenshots
  and project artwork, rather than newly captured live website screenshots.

## 1 November 2026 - enigma homepage in the existing Next.js app

- Moved the studio website into native React/Next.js routes at `/home`,
  `/home/en` and `/home/mk` on port 3001, with scoped CSS Modules and copied
  public assets. Removed the earlier standalone port-3002 server and static build.
- `/home/contact` validates public same-origin submissions and stores enquiries
  in a separate private `.data/home-inquiries.sqlite` inbox. Existing admin owner
  authentication, CRUD mutation checks, business data and Stripe settings were
  left unchanged. No email notifications or deployment were configured.
- TypeScript, the production build and all 55 shared tests passed, including
  12 homepage tests with mock inboxes and temporary databases. Tests cover locale
  precedence, trusted country headers, input/consent validation, private storage,
  persistence failure, origin checks, request limits and native form redirects.
- Local HTTP checks returned 200 for all three page routes, both language titles
  and assets; invalid locale returned 404, invalid contact input returned 400,
  and a foreign contact origin returned 403. No real inquiries or business records
  were written during verification. Visual review remains with the owner.

## 31 October 2026 - Marketing details without duplicate information

- Removed the nested Original imported record and source pages section. Unique
  earlier notes and complete related contest details are visible directly.
- Expanded contacts show email addresses once as inline links. Compact email and
  next-action previews move into the open details instead of appearing twice;
  names, dates and status badges remain in the summary row. Identical website /
  evidence links and repeated payment/relationship/notes text are consolidated.
- Read-only checks rendered contact channels for all 179 contacts and confirmed
  one link per email, retention of current notes and unique earlier notes,
  consolidation of 77 duplicate payment-note blocks and removal of 43 duplicate
  website links. No saved business records were modified.
- TypeScript and the production build passed. Dashboard visual review remains
  reserved for the owner.

## 31 October 2026 - Marketing filter controls and gray backgrounds

- Extra filters start collapsed behind Show more filters / Hide filters. Search,
  result count and Clear filters stay visible. Collapsing preserves selections;
  the toggle shows how many extra filters are active.
- Even contacts and their expanded details use the owner's selected `#f5f5f5`
  gray. Hover and selected states remain clear.
- TypeScript passed. No business records changed; visual review remains with
  the owner.

## 31 October 2026 - Marketing details expansion

- Every even contact has a soft gray background, including its expanded details.
  Alternation follows filtered/sorted contact positions and continues across
  pages; inserting a details row does not shift the contact colors.
- Details and the business name now toggle an expanded section directly beneath
  the selected contact row. A second click collapses it; closing from inside
  returns focus to the opening button. Filter and page changes close details.
- Removed the detached panel below the list and its forced scroll. Existing
  contact details, edit actions, source history and contest notes remain available.
- TypeScript and the production build passed. Source checks confirm inline
  placement, toggle behavior and removal of scrolling code. No business data was
  changed; dashboard visual review remains with the owner.

## 31 October 2026 - Marketing prospect archive

- Restored Marketing in the admin sidebar as a separate owner-authenticated JSON
  directory. Imported 179 historical lead records from the two Business Prospects
  PDFs, preserving every populated field, original source pages, UTF-8 names and
  currency symbols, the expanded Evin note and its earlier year-tab wording.
  Duplicate year tabs were not imported again. No corroborated 2013 rows exist.
- Cross-checked all 179 rows' archive year, priority and last-contact date against
  character coordinates in the compressed original tracker; business-name
  prefixes, yearly totals and all contest IDs also agree. Retained 19 contest
  records, attaching 18 to their explicit leads and retaining the unidentified
  crowdSPRING platform award in the full contest archive.
- Search and combined priority/year/contact-date/payment/stage/email/follow-up
  filters, sorting, 25-row pagination, original source details, shared-email
  notices, editable campaign fields, add/delete, filtered CSV and complete JSON
  backup are implemented. Historical payment amounts remain source notes; quotes,
  deposits, expected prizes and unresolved payments do not become Stripe totals.
  Campaign stages and follow-ups are manual; no sending or mailbox integration.
- All 43 tests passed, including 5 new tests covering temporary-file persistence,
  preserved evidence/audit/backups, stale edits/deletes, parallel writers,
  empty-list persistence, corrupt/missing-file refusal, production path checks,
  combined filters, calendar dates, unsafe URLs and CSV formula escaping.
  TypeScript and the Next.js production build passed with `/api/marketing`.
- Local HTTP API returned 179 contacts and 19 contests; normal reads omit full
  audit snapshots, while the explicit JSON backup is an attachment. Both local
  origins passed mutation checks and malformed JSON returned 400. Foreign origins,
  missing origin and missing request marker returned 403. These HTTP checks left
  the private file unchanged; no fake records were written to the owner's data.
- Dashboard visual review remains reserved for the owner. No hosted deployment,
  database migration, Stripe sync or external financial operations were performed.
  Marketing JSON requires a persistent Node filesystem for hosting and has its
  own backup; it is not part of SQLite/D1 exports. See `docs/SETUP.md`.

## 30 October 2026 - client information and payment dates

- Client directory uses Monthly pricing with amount-only values, including
  monthly equivalents for active quarterly/yearly services. The three-dot menu
  contains Edit and More info; optional names, extra contacts/emails, notes and
  customer references are collapsed in the Add/Edit form.
- Migration 0004 preserves existing clients while adding names and synced
  subscription schedule fields. Extra contacts use the existing contacts table.
- All 38 tests and TypeScript checks passed, including optional contact creation,
  update/removal, preservation, ownership, rollback after concurrent edits,
  export/restore, monthly price calculation, Stripe schedules and earliest payment
  aggregation beyond the displayed row limit.
- Local D1 integration passed with optional client names/contacts and billing
  aggregates. Local production build passed. Dashboard visual review remains
  reserved for the owner.
- Read-only Stripe refresh and local API snapshot confirmed Breeze's first
  maintenance payment is 30 Oct 2026 and its next expected payment is 30 Nov 2026
  in Europe/Skopje. No sample names or assistant contacts were added to real data.

## 30 October 2026 - maintenance subscription billing

- Read-only live Stripe requests confirmed the supplied Breeze Payment Link
  created an active $25/month USD subscription and a successful $25 payment.
  Its customer differs from the earlier $250 one-time payment's customer.
- Saved a consistent SQLite backup before repairing local billing records.
  Corrected Breeze's customer reference and linked its verified maintenance
  subscription to a $25 monthly service. No Stripe financial writes were made.
- Actual local `/api/snapshot` response: live mode, one paid maintenance invoice
  for 2500 USD minor units, one successful payment for 2500, received total 2500,
  and no unrelated 25000 payment in the payment list. Legacy records are retained
  in private exports/database backups and excluded from lists/CSV/totals.
- Admin TypeScript check and all 31 tests passed. Regressions cover different
  checkout customers, explicit maintenance scope, one-time payment exclusion,
  invoice/payment/charge relationships in Clover, cash versus credits or unpaid
  invoice payments, refunds, pagination, repeat syncs, signed webhook retries,
  identity checks, mapping conflicts and complete financial totals.
- Final local D1 integration passed with the new migration and a $250 legacy
  payment excluded alongside a visible $25 maintenance payment.
- Admin production build passed. No dashboard visual inspection or deployment.
- Hosted installations must apply migration 0003 before deploying this version
  and confirm each linked service's Stripe environment. The setup PDFs predate
  this change; current workflow is in `STRIPE-SETUP.md` and `docs/SETUP.md`.

## 29 October 2026 - original baseline

### Passing checks

- Admin TypeScript check and Next.js production build.
- 27 admin tests: persistent entity behavior, conflicting edits, service/site
  ownership, validation, local access restrictions, approved monitoring targets,
  expected-content/CMS identity checks, incident recovery, payment/invoice
  separation, refund updates, Stripe history pagination, signed webhook replay and
  duplicate handling, frozen customer mappings, fresh-database import, onboarding,
  timezone boundaries, financial totals beyond the displayed record limit, and
  local/hosted mutation origin validation, communication timelines and reminders,
  last-email calculation, retained history after client conversion, repeat-safe
  logging, legacy export preservation, database upgrades and individual USD prices.
- Local D1 emulator integration: API bearer/origin checks, seed registration,
  settings persistence, optimistic edit conflict and export.
- Agency Worker Wrangler dry-run bundle. No deployment was performed.
- Breeze CMS TypeScript check and 2 new monitor tests, covering opt-in access,
  distinct monitoring credentials, browser-origin rejection, safe readiness data
  and denial of content-write access.
- Breeze Next.js production build with `CMS_TEST_ENABLED=false` and
  `CMS_LIVE_ENABLED=false` for that command only. The local CMS Worker was stopped;
  the normal enabled-CMS build therefore failed on its existing localhost:8787
  dependency. No `.env.local` values were changed.
- Local admin HTTP requests: snapshot 200 with Breeze registered; cross-origin
  mutation 403; malformed JSON 400. No test clients/payments were inserted into
  the user's local database.
- Local save-origin regression: both localhost:3001 and 127.0.0.1:3001 pass the
  origin gate. HTTP checks deliberately used malformed JSON (400 after the gate)
  so existing business settings were not modified. Foreign origins, other ports,
  missing headers and production local-bypass attempts remain rejected.
- PDF generation, text/bounds checks and rendered-page inspection.
- SQLite snapshot backup, JSON export and restoration into a new database with
  an `integrity_check` result of `ok`.

### Existing Breeze suite failures

The full CMS suite returned 79 passes and 3 failures (82 tests including nested
tests). New monitoring checks passed. The three failures are in existing test
expectations for untouched frontend files:

1. `workers/cms/tests/editor.test.mjs:26`: expects `Saved draft`; the current editor
   returns `Draft saved - not published` (with an em dash in the actual string).
2. `workers/cms/tests/editor.test.mjs:46`: expects `Published`; the current editor
   returns `Live on website`.
3. `workers/cms/tests/home.test.mjs:15`: its old fixture expects the former native
   service form; the current ContactSection renders the documented Housecall Pro
   integration. The public form implementation was not changed by this work.

Those UI files/tests/fixtures were not changed to hide the existing mismatches.
They need a separate deliberate baseline refresh against the intended Breeze UI.

### Not exercised in the original baseline

- Live Stripe account requests, charges or financial operations.
- Real Cloudflare Access sign-in, production deployment, domains or scheduled jobs.
- Live website/CMS probes. Monitoring remains disabled in the initial seed.
- Dashboard visual review, which the user chose to perform themselves. Browser
  automation was attempted before that instruction but stopped because the browser
  tool could not reliably identify the current Chrome URL. No further UI checks
  were made.

The setup guide lists the remaining account/key/deployment steps and initial
record-volume limits. Local and emulated tests do not establish production health.
