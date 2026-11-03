# Website Products: project context for agents

Last updated: 2 November 2026. Read this first, then open only the files relevant
to the task. Keep this file current when architecture, features or setup change.
Read any nested `AGENTS.md` before editing its project.

## What this business and app do

The owner runs a website development and maintenance business based in North
Macedonia. This root workspace is the business hub. Each client website keeps its
own project folder, content, styles, CMS and deployment. `breeze-web/` is the first
client project; the shared Next.js app now runs from this workspace root. Dashboard
source is in `src/admin/` and public website source is in `src/website/`.
The owner's public one-page
studio website uses the working brand **enigma** and the approved public email
`nikodola@gmail.com`. It is local-only for now, served by the existing Next.js app
at `http://127.0.0.1:3001/home`. `home/` retains its docs and original hero artwork.
Homepage headings omit eyebrow labels. Contact links scroll smoothly, and the
three-line mobile menu animates to an X. Reviews are slow left-to-right cards
that pause on hover, touch, keyboard focus or the Pause button. Per the owner's
request, the loop stays active with reduced motion at a gentler speed; its Pause
control stays visible. Link scrolling uses a cancellable animation, shortened
with reduced motion. The third experience item reads “Building lasting trust.”
The normal review loop takes 90 seconds (150 with reduced motion). The long
review disclaimer is removed; per-card sample labels remain readable. The form
has no consent checkbox; new submissions leave legacy `consent_at` empty.
Next.js self-hosts website fonts and serves responsive hero/portfolio images.
The public homepage permits indexing so Lighthouse SEO can be checked locally.
Local-only does not require noindex and is not a deployment authorization. Keep
the dashboard, private API and contact endpoint excluded from indexing.
Do not infer development mode from port 3001: a running `next start` process
keeps the loaded build until restarted. Verify served settings after changes.
The owner's normal shared local server must use `npm run dev` on port 3001 so
the existing local-admin shortcut works. `next start` disables that shortcut.
Run temporary production/Lighthouse servers on a separate port and stop them
afterward; do not replace the owner's development server with production mode.
The primary homepage offer is new websites and redesigns, followed by branding
and maintenance. Bilingual copy includes practical FAQs and the enquiry process.
See `home/CONTENT-AUDIT.md` for the review and remaining proof/launch gaps.
Routes live in `src/app/`: separate `(website)` and `(workspace)` root layouts
isolate CSS, metadata and error UI. `/home` remains public; `/admin` is the owner
dashboard. `/` redirects to `/admin` and preserves the old `?view=` selection.
`admin/` retains existing private `.data` files and compatibility npm commands;
it is no longer a second Next.js app. Root `.env.local` was moved byte-for-byte.

Payment screens and financial totals track only recurring maintenance subscriptions
clients pay TO the owner's business. Each client has an individual price. Business
defaults are USD (`usd`) and `Europe/Skopje`.

Current navigation: Overview, Clients, Websites, Payments, Communications,
Marketing, Tasks, Settings. Marketing was restored on 31 October as a separate
JSON-backed historical prospect directory. Calls and Orders remain retired.
The old marketing/call/order database tables remain in backups/exports and are
not used by the new Marketing section. Marketing now has Current Clients at
`/admin/marketing/current-clients` and New Clients at
`/admin/marketing/new-clients`. `/admin/marketing/` and the legacy
`/admin?view=marketing` open Current Clients. That label denotes the existing
historical Marketing directory; it never converts records into actual clients.

New Clients is an independent manual HVAC lead/outreach system. Its SQLite file
is `admin/.data/outreach.sqlite`, separate from the historical Marketing JSON,
Clients, Communications and Stripe. It starts empty. Gmail connections use the
app's own OAuth web client (not the assistant's Gmail connector), owner-bound
one-use OAuth state, an HttpOnly browser-binding cookie, PKCE and AES-256-GCM
encrypted credentials. Sender accounts request gmail.send + gmail.readonly;
receiver-only accounts request gmail.readonly. Configure GMAIL_CLIENT_ID,
GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI and a stable 64-hex-character
OUTREACH_ENCRYPTION_KEY before connecting. Never expose tokens to the browser.
Hosted operation requires persistent absolute OUTREACH_DATA_PATH on Node;
the existing D1 Worker does not persist outreach, and Vercel is rejected.
OAuth starts must use the configured callback origin. A localhost/127.0.0.1
mismatch returns to the configured address before creating state/cookies; the
owner then clicks Connect again. Callback failures use fixed safe reason codes
and owner-only audit entries, never raw provider errors, codes or tokens. The
banner distinguishes browser/session failures, denied consent, missing scopes,
disabled Gmail API and rejected credentials. Status query parameters are cleared
after display so old errors do not return on a later refresh.

Each outgoing email requires a manual review and Send this email action. Drafts
show Email, Caption (the actual Subject) and Markdown Message as separate fields,
in that order. A pasted bold recipient line followed by a bold caption can also
be extracted into those fields; neither header becomes message text. Daily limits default to 10 per sender,
reset in OUTREACH_TIMEZONE (Europe/Skopje). Transactional quota reservations,
saved versions and content fingerprints prevent concurrent or repeated sends.
Timeouts remain uncertain and are reconciled by Message-ID; never retry an
uncertain Gmail send automatically. Spam/Inbox placement requires exact-message
evidence in the explicitly connected, designated recipient test mailbox. Normal
recipients always have unknown placement. Verified Spam pauses sending; auth
errors require reconnecting; repeated confirmed bounces pause and bounced
recipients are suppressed. All monitoring is manual. No AI or bulk sends exist.

The Texas picker shows all 9,591 dataset locations in an alphabetical, scrollable
native select with a search bar above it. The owner removed manual HVAC company
entry; messages can be composed directly without saving a lead. Existing saved
leads and optional discovery remain available. The picker uses the GeoNames dataset in
`data/texas-locations.json`, with county crosswalk, source hashes and CC BY 4.0
attribution. Refresh with `npm run locations:import`. Location search makes no
external calls. Optional OUTREACH_DISCOVERY_ENABLED=true enables button-triggered,
cached, rate-limited OpenStreetMap/Overpass HVAC discovery within 20 km, with ODbL
attribution. Confirm service area/contact details manually; no contacts are
invented or scraped. No paid API is enabled. See `docs/OUTREACH.md` for credentials,
scope review, costs, limitations and setup. `npm run outreach:backup` makes a
separate consistent private backup; preserve the encryption key separately.

Marketing imports 179 source lead records from the two root Business Prospects
2013-2026 PDFs and retains all 19 contest-history entries, including a platform
award without an identified client. Year tabs duplicate the combined source;
do not import them again. No corroborated 2013 client rows exist in these PDFs.
The private file is `admin/.data/marketing.json`, not browser localStorage or
the client/Stripe database. Add/edit/delete use owner authentication, mutation
origin checks, file locking, record versions, atomic replacement, a previous-file
backup and before/after audit entries. Import history remains attached to edits.
Historical paid/deposit evidence, quotes, unresolved payments and expected prizes
are separate classifications; none changes financial totals. Keep original
amount/currency wording in notes. Do not infer payments from delivered files.
Search, priority/year/contact-date/payment/stage/email/follow-up filters, sorting,
pagination, CSV export and an independent JSON backup are available. Campaign
stages/contact dates/follow-ups are updated manually; Current Clients sends no email.
Marketing Details expands directly below the selected contact row and toggles
closed on a second click. Do not move details beneath the list or scroll to them.
Show contact information directly, without a nested original-record/source-pages
section. Email addresses appear once as inline links in the contact channel;
identical website/evidence links and repeated relationship/payment/notes text are
deduplicated for display. Unique earlier notes and complete related contest
details remain directly visible. Original history stays in private JSON/backups.
Alternate contact backgrounds between white and light gray by filtered list
position; expanding details must not change the alternating contact colors.
The owner-selected even-contact background is `#f5f5f5`, including expanded details.
Search stays visible; extra Marketing filters start collapsed behind Show more
filters / Hide filters. Collapsing preserves selections and shows an active count.
The source PDFs and JSON files are private and ignored by Git. The import script
refuses to overwrite an existing destination, including an intentionally empty list.

Clients shows a compact directory with Monthly pricing (amount only, such as
$25.00). Active quarterly/yearly service prices are converted to monthly
equivalents; currencies and test/live subscription environments stay separate.
Each client's three-dot menu has Edit (pencil) and More info (information icon).
More info shows first maintenance payment, next expected Stripe payment, optional
first/last name and additional contacts/emails. Add/Edit initially shows only
business name, primary email, phone and status. A collapsed More information
section holds optional names, extra contacts, Stripe customer IDs and notes.
Additional contacts are managed there; the main directory has no separate
contact-person table. Never invent names or assistant details for a real client.

Communications tracks potential and existing clients: conversation stage,
email/phone, sent emails, replies, notes, last email sent, next follow-up and next
action. Emails are logged manually; there is no mailbox sync or automatic email
sending. Creating a client from a conversation retains its history. Follow-up
dates appear in the dashboard; the app does not send reminder emails.

## Architecture and folder map

| Location | Purpose |
| --- | --- |
| `src/app/` | Root Next.js 16 / React 19 App Router; shared development port 3001 |
| `src/app/(workspace)/` | Separate admin root layout, `/admin` and old-root redirect |
| `src/app/(website)/` | Separate public website root layout and error boundary |
| `admin/` | Preserved private data and legacy npm command forwarding; no application source |
| `home/` | enigma website docs and original generated hero artwork; runtime is in the existing Next.js app |
| `src/app/(website)/home/` | Native `/home`, `/home/en`, `/home/mk` pages and `/home/contact` POST route |
| `src/website/` | enigma React components, scoped CSS Module, bilingual content and public site configuration |
| `src/website/portfolio.mjs` | Breeze, GMunchies Vending, Emilija Petrova, T. Hendo and Indoor Plants: live links, bilingual summaries and sample review drafts |
| `src/shared/home-locale.mjs` | Homepage language selection and trusted country headers |
| `src/shared/home-contact*.mjs` | Contact validation, origin checks, rate limits and private inquiry inbox |
| `src/admin/components/Dashboard.tsx` | Main navigation, clients, sites, payments, services, tasks and settings UI |
| `src/admin/components/Communications.tsx` | People, conversation timeline, manual email logging and follow-ups |
| `src/admin/components/Marketing.tsx` | Historical prospects, campaign filters, contact editor and contest archive |
| `src/admin/components/MarketingHub.tsx` | Current Clients / New Clients navigation inside the existing dashboard |
| `src/admin/components/NewClients.tsx` | Gmail cards, manual composer, history and suppression controls |
| `src/admin/components/LeadDirectory.tsx` | Full searchable Texas select, optional discovery and saved leads |
| `src/admin/server/outreach-store.mjs` | Independent outreach SQLite, encrypted tokens, versions, quotas, dedupe and audit |
| `src/admin/server/outreach-gmail.mjs` | Gmail OAuth, single-message send and evidence-based refresh |
| `src/admin/server/texas-locations.mjs` | Local GeoNames Texas location search |
| `src/admin/server/outreach-discovery.mjs` | Opt-in, cached OpenStreetMap HVAC lookup |
| `src/app/api/outreach/` | Owner-authenticated outreach, OAuth, geographic search and discovery endpoints |
| `docs/OUTREACH.md` | New Clients setup, scopes, costs, workflow, evidence limits and backup |
| `src/admin/components/Modal.tsx` | Shared accessible editor/details dialog |
| `src/admin/components/ClientActions.tsx` | Three-dot client menu, rendered in a portal to avoid table clipping |
| `src/admin/components/ClientDetails.tsx` | Client More info, billing dates and optional contact details |
| `src/admin/components/RecordForm.tsx` | Shared forms with collapsed optional client information |
| `src/admin/components/AdditionalContacts.tsx` | Optional repeated contact/email fields in the client form |
| `src/admin/admin.css` | Admin styling |
| `src/app/api/[[...path]]/route.ts` | Next API entry point, including Stripe webhook forwarding |
| `src/admin/server/backend.ts` | Selects local database dispatch or hosted Worker backend |
| `src/admin/server/auth.ts` | Owner authentication and mutation checks |
| `src/app/api/marketing/route.ts` | Authenticated Marketing JSON API and complete backup download |
| `src/admin/server/marketing-store.mjs` | Atomic private JSON storage, versions, backups and change history |
| `src/shared/marketing.mjs` | Contact validation, combined filters, safe links and CSV formatting |
| `src/admin/server/local.mjs` | Local SQLite adapter and database initialization |
| `src/admin/server/migrations.mjs` | Applies local SQL migrations once, transactionally |
| `src/shared/server/paths.mjs` | Keeps storage in `admin/.data`; preserves old admin-relative configured data paths |
| `scripts/platform/` | Root-run backup, export, restore, sync, monitoring and homepage inbox commands |
| `src/shared/entities.mjs` | Active entity fields, form metadata and validation |
| `src/shared/platform.mjs` | CRUD, seed data, snapshot/totals, audit and job locks |
| `src/shared/router.mjs` | Shared API routing and export table list |
| `src/shared/communications.mjs` | Timeline queries, repeat-safe logging and client conversion |
| `src/shared/stripe.mjs` | Stripe GET requests, subscription-scoped invoice/payment import and signed webhook reconciliation |
| `src/shared/monitor.mjs` | Website/CMS probes, health history and incident handling |
| `src/shared/security.mjs` | Local access, request-origin and secret comparison helpers |
| `src/shared/import.mjs` | Validated restoration into a fresh database |
| `src/shared/time.mjs` | Business timezone and reporting boundaries |
| `src/shared/client-summary.mjs` | Monthly price equivalents and Stripe subscription schedule interpretation |
| `workers/api/src/index.mjs` | Cloudflare Worker API, D1 adapter and scheduled jobs |
| `workers/api/migrations/` | Shared SQL schema; apply new migrations to hosted D1 before using new features |
| `workers/api/wrangler.jsonc` | Worker configuration, D1 binding and schedules |
| `tests/` | Shared logic tests and D1 integration checks |
| `breeze-web/` | Independent client website and its own CMS; development port 3000 |
| `breeze-web/site.config.json` | Nonsecret project manifest |
| `breeze-web/workers/cms/src/monitor.ts` | Optional, separately authenticated, read-only CMS status endpoint |
| `templates/website-starter/` | Sanitized starter for another client website |
| `scripts/new-site.mjs` | Creates a project from the starter |
| `scripts/import-marketing-prospects.py` | Reviewed PyMuPDF import with counts and original-tracker cross-checks |
| `docs/SETUP.md` | Detailed configuration, hosting, billing, backups and onboarding instructions |
| `STRIPE-SETUP.md` | Checked Stripe key lifecycle, exact setup steps and direct Payment Link tracking gap |
| `docs/VERIFICATION.md` | Recorded verification results and known baseline failures |
| `WEBSITE-PRODUCTS-SETUP-v2.pdf` | Earlier setup snapshot; use current Markdown guides for root app paths |
| `scripts/build_setup_pdf.py` | Builds the setup PDF from the setup documentation |

`main-app-info.txt` contains the earlier review/proposal as well as later notes.
Use this file and current source for the current scope.

## Data and hosting

- Local development uses Node 22.16+ within Node 22 and built-in `node:sqlite`.
  Records persist in `admin/.data/platform.sqlite`; migrations run automatically.
- Run Next.js and platform scripts from the workspace root. The default SQLite,
  Marketing JSON and inquiry paths still use `admin/.data`, without copying or
  re-seeding records. Relative `PLATFORM_DB_PATH` / `MARKETING_DATA_PATH` values
  keep their former meaning relative to `admin/`; absolute paths are unchanged.
  Backups remain in root `backups/`. CLI tools are in `scripts/platform/`.
- Local configuration belongs in `.env.local`; use `.env.example` as
  the reference. Do not overwrite an existing configuration file.
- With `PLATFORM_API_URL` configured, the admin calls the Cloudflare Worker using
  a server-side `PLATFORM_API_TOKEN`. The Worker stores records in D1 and runs
  Stripe/monitoring jobs. Configure integration secrets on the Worker in this mode.
- Hosted operation requires the persistent backend and Cloudflare Access owner
  authentication with an explicit allowed-email list. Local bypass is restricted
  to development on localhost/127.0.0.1 port 3001; production rejects it.
- Mutations verify the origin and `x-platform-request` header. Hosted requests
  must match the configured HTTPS admin origin.
- Records use versions to prevent conflicting edits. Preserve transactional
  writes, relation ownership validation and audit history when changing data flows.
- Marketing JSON is separate from SQLite/D1 exports. Use Marketing > JSON backup
  for its contacts, source metadata, contest history and audit snapshots. A hosted
  Marketing installation requires an explicit absolute `MARKETING_DATA_PATH` on
  a persistent Node filesystem; the existing Worker D1 backend and Vercel
  ephemeral storage do not automatically persist this JSON file.
- Backups/exports include private business records. Keep secrets, databases,
  backups, `.env*`, build output and dependencies out of source control.
- The enigma contact form saves inquiries to `admin/.data/home-inquiries.sqlite`,
  separate from the admin. Read with `npm run home:inbox`; it sends no emails.
  Production needs an HTTPS `HOME_PUBLIC_ORIGIN`, persistent absolute
  `HOME_INQUIRIES_DATA_PATH` and a trusted, overwriting country header for geographic
  language defaults. Explicit `/home/mk` and `/home/en` URLs and manual preference work
  independently. All five project reviews are visibly labelled sample drafts;
  replace only with approved client wording. Portfolio thumbnails use existing
  screenshots/artwork copied from the owner's Junk code projects, with live links;
  they create no admin client/payment records. See `home/README.md`.

## Stripe: what exists and what still needs connecting

The app imports **invoices and payments for explicitly linked recurring maintenance
subscriptions**. It makes GET requests to Stripe; billing, payment links, subscriptions,
refunds and cancellations are managed in Stripe. A local service agreement records
the agreed price; it does not create a Stripe subscription or invoice.

Use `STRIPE-SETUP.md` for key setup. Dashboard-created restricted keys have no
standard 30-day renewal requirement. Do not confuse the old-key expiration during
rotation with the new key's lifetime. Hosted webhooks use Snapshot payloads with
the pinned version; the current handler does not consume thin event payloads.

Current connection workflow:

1. Configure `STRIPE_SECRET_KEY` and matching `STRIPE_MODE` (`test` or `live`) on
   the server performing the sync. Prefer a restricted key with the required read
   permissions. Never place it in browser code or a client record.
2. In Payments > Services, add a maintenance service with its real `sub_...`
   subscription ID and matching `stripe_mode` (`test` or `live`). No invoices or
   payments are imported without a linked recurring service in the active mode.
3. Use Payments > Sync Stripe. Invoices show amounts due and invoice status;
   Transactions shows actual charge/refund status. A service agreement alone is
   not evidence of a missing payment.
4. For automatic hosted updates, configure Stripe's signed webhook endpoint at
   `https://YOUR-AGENCY-WORKER.workers.dev/api/webhooks/stripe` and set its
   `STRIPE_WEBHOOK_SECRET`. See `docs/SETUP.md` for the supported event list and
   pinned API/event version (`2025-09-30.clover`). The hosted Worker also syncs
   hourly at minute 17. Local development needs manual sync or Stripe CLI forwarding.

The owner supplied this Breeze payment link:
`https://buy.stripe.com/cNi4gzeDO1cV6pq0Rf3gk0f`.
Read-only live Stripe requests on 30 October verified that the link produced an
active $25/month USD subscription and a successful $25 payment. Stripe created
a DIFFERENT customer for that subscription than for the earlier $250 one-time
payment. The local app was backed up, Breeze's customer reference corrected,
and a real `breeze-maintenance` service linked to the verified subscription.
Its paid invoice and payment were synced successfully. The $250 legacy record
remains in private exports but is excluded from views, CSVs and financial totals.
The local config uses `STRIPE_MODE=live` and a working restricted key. Backend URL
and webhook secret were empty; local updates use manual sync. Recheck current
configuration without printing secrets before reporting connection status.

Migration 0003 adds `agreements.stripe_mode`, invoice subscription IDs and payment
service/subscription/invoice associations. The snapshot and all billing totals
join these associations to the exact maintenance service. The reader retrieves
each pinned subscription's actual customer, then its invoices, Invoice Payments,
Payment Intents and charges. Do not import every charge for a customer. Clover
removed `charge.invoice`; invoice payment relationships must use Invoice Payments.
Refunds update charge records; credits/out-of-band settlements do not become
Stripe cash. Subscription/client mappings are protected once maintenance history
exists. Apply migration 0003 to hosted D1 before deploying this version.

Migration 0004 adds client first/last names and read-only Stripe schedule fields
on agreements. First-payment dates come from a complete scoped SQL aggregate
(`client_billing`), not the limited payment list. Until history backfill completes,
the UI calls this Earliest imported payment. Next expected payment comes from
Stripe subscription item billing periods/trial end, refreshed by sync/webhooks;
paused, canceled and invoice-only subscriptions do not get invented charge dates.
On 30 October the actual local API showed first payment 30 Oct 2026 and expected
next payment 30 Nov 2026 for Breeze, displayed in Europe/Skopje. Apply migration
0004 before deploying this code to D1.

`additional_contacts` is a virtual client-form field persisted atomically into
the existing contacts table. Omitted/untouched contacts are preserved. Updates
and explicit removals validate ownership and versions and roll back with the
client on a conflict; do not replace the whole contacts list from a stale form.

**Known gap:** there is no general Payment Link URL-entry/discovery feature. A
one-time repair verified Breeze's supplied link through Checkout Sessions and
linked its actual subscription. The ongoing app tracks that subscription; it
does not map arbitrary URLs, `client_reference_id` or Checkout Session events.

If implementing direct link tracking, associate a verified Stripe `plink_...` ID
with the intended client/service, reconcile its Checkout Sessions server-side and
handle signed payment events, delayed success/failure and repeat deliveries.
Check actual payment status; a completed checkout or success-page visit alone does
not prove funds were collected. Preserve recurring invoice/charge tracking for
later maintenance periods. Do not guess client identity from an email address or
treat a caller-supplied reference as proof of identity. Validate the expected link,
mode and service before assigning a payment.

Local live maintenance sync has been verified. Hosted secrets, webhook
configuration and production deployment still require the owner's account setup.
Confirm current configuration without printing secret values before reporting
whether an integration is connected. No Payoneer integration is implemented.

## Website health and project boundaries

- Monitoring requires both an enabled website record and its exact hostname in
  `MONITOR_ALLOWED_HOSTS`. Initial Breeze monitoring is disabled.
- CMS checks use a separate read-only `CMS_MONITOR_TOKEN`, never the CMS write
  credential. Server mapping is `CMS_MONITOR_TOKENS_JSON`.
- Two failed checks open an incident; recovery resolves it. Hosted monitoring
  runs every five minutes. Website availability never changes automatically
  because a client payment fails.
- The root now has a Git repository; `breeze-web/` retains its independent one.
  Root `.gitignore` explicitly excludes `/breeze-web/`. Recheck repository state
  before Git operations and do not alter global Git configuration.
- Read `breeze-web/AGENTS.md` and its referenced project docs before changing that
  website. Read `src/AGENTS.md` and relevant installed Next.js docs before
  framework changes; do not assume familiar Next.js behavior matches this version.

## Useful commands and working preferences

Run commands from this root unless stated otherwise:

```powershell
npm run dev                         # Admin at http://127.0.0.1:3001/admin
npm run dev:breeze                  # Separate client website on port 3000
npm run dev:home                    # Same Next.js server: enigma at localhost:3001/home
npm run test:home                   # Isolated home-site tests
npm run build:home                  # Build the Next.js app including enigma
npm run home:inbox                  # Read private incoming home-site inquiries
npm run typecheck
npm test                           # Admin shared logic tests
npm run build                      # Shared Next.js production build
npm run test:cloud                  # Local D1 emulator integration
npm run check                      # Typecheck + tests + build
npm run sync                       # Manual Stripe import using server config
npm run monitor
npm run backup
npm run site:new -- --id new-client --name "New Client" --dry-run
```

The owner will inspect the dashboard themselves. Do not open or visually inspect
the dashboard unless they ask. Use appropriate source checks and focused tests
for implementation changes. Documentation-only edits do not require an app build.

Existing Breeze test expectation mismatches are recorded in
`docs/VERIFICATION.md`; consult that file before treating them as new regressions.
Do not add fake clients, communications or payment records to the owner's database
for verification. Use temporary/test databases.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
