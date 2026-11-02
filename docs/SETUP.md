# Website Products - setup and operations

Prepared 29 October 2026. The implementation lives in this workspace. External
accounts, API keys, domains and production deployment are configured by you using
the steps below. No payment operations are performed by this admin.

## Marketing contact archive (added 31 October 2026)

Open **Marketing** in the admin sidebar. The two root Business Prospects
2013-2026 PDFs have been imported into `admin/.data/marketing.json`: 179 historical
lead/contact records and 19 contest-history entries. The individual year tabs
repeat the combined tracker and are not imported twice. The sources contain no
corroborated 2013 client rows. Inquiries, former employers, unverified businesses
and paid clients retain their original relationship notes.

Search names, emails, relationships and original notes; combine priority, archive
year, last-contact range, payment evidence, campaign stage, email availability and
follow-up filters. Change the sort order or export the filtered list as CSV.
Open Details for full source notes/links and related contest history. Use Add,
Edit and Delete to manage the list; original imported history stays attached to
edits. Contact dates, campaign stages and follow-up dates are managed manually.
No campaign emails or reminders are sent automatically.

Details opens directly under the contact and shows its information without a
second original-record section. Emails are clickable in the contact channel;
matching links and repeated notes are displayed once. Unique earlier notes and
related contest details are visible directly. Original import snapshots remain
in the private JSON backup rather than appearing as another copy in contact details.

Historical payment classifications describe only evidence in the PDFs. Paid,
deposit, unresolved, quote/terms and prize/award records stay separate. Original
amounts/currencies are retained in payment/source notes. These records do not
create Stripe payments or change maintenance totals.

**Backups:** use **Marketing > JSON backup** to download the complete independent
archive, including change history. SQLite/D1 exports and `npm run backup` do not
include this JSON file. Each marketing mutation also saves the immediately
previous complete file as `admin/.data/marketing.json.backup.json`. To restore,
stop the admin, preserve the current file, copy the chosen complete JSON backup
to `admin/.data/marketing.json`, then restart. The source PDFs and `.data` files
are private and excluded from source control. Never place them in `public/`.

The initial importer requires Python with PyMuPDF (`python -m pip install
PyMuPDF`) and runs from the workspace root:

```powershell
python scripts/import-marketing-prospects.py
```

It refuses to overwrite an existing destination. To review a new import, use
`--output tmp/marketing-review.json`, then compare it with saved edits. Removing
all contacts deliberately leaves an empty list; the app never re-imports them.

Local mode defaults to `admin/.data/marketing.json`. `MARKETING_DATA_PATH` can
select another location. Hosting this JSON section requires an explicit absolute
path on a persistent Node server or mounted volume, plus the existing owner
authentication. The app refuses an implicit production JSON path. The existing
Cloudflare D1 Worker does not store these files; a Vercel temporary filesystem
does not provide durable marketing storage. No deployment changes were made.

If a process is forcibly stopped during a save, a `.lock` file can remain. Stop
all admin processes, check the current JSON/backup, and remove only that stale
marketing lock before restarting. Never remove a lock while a save is running.

## 1. Start locally now

Use Node.js 22.16 or a newer Node 22 release. Open a terminal in
`C:\Users\Dolov\Desktop\solid-code\website-products`.

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:3001/admin** or **http://localhost:3001/admin**. The public
website is at `/home`; the old `/` entry redirects to `/admin`. Breeze development keeps
port 3000; the admin uses 3001. Keep the terminal running and stop it with Ctrl+C.
Local development is restricted to this computer. It needs no external keys.
`npm start` is production mode and requires hosted identity/backend configuration;
use `npm run dev` while working locally.

The first API request registers Breeze, with monitoring disabled and no invented
contacts, service prices, health results or payments. Your records persist in
`admin/.data/platform.sqlite`. Browser refreshes do not erase them.

The application package and `.env.local` now live at the workspace root; routes
are in `src/app`, dashboard source in `src/admin`, and public website source in
`src/website`. Existing data stays in `admin/.data`, with no migration or reset.
Run platform scripts through the root npm commands. Relative `PLATFORM_DB_PATH`
and local `MARKETING_DATA_PATH` overrides retain their previous meaning relative
to `admin/`; use absolute paths when configuring a different storage location.
Backups still go to root `backups/`. The setup PDFs predate this reorganization;
this Markdown guide and `STRIPE-SETUP.md` contain the current paths.

In the admin:

1. Edit **Settings > Business details** for your name and email. The business is
   based in North Macedonia, with USD and Europe/Skopje selected by default.
2. In **Clients**, use Breeze's three-dot menu and choose **Edit** to enter
   confirmed contact details. Monthly pricing shows the amount only.
3. Expand **More information** when adding/editing a client to enter optional
   first/last names, assistant/billing contacts or other emails, notes and Stripe
   customer references. These fields start collapsed. Use the client's
   **three-dot menu > More info** to see those details, its first maintenance
   payment and its next expected Stripe payment. Empty extra-contact sections
   are hidden. Additional contacts are saved with the client.
4. Add maintenance under **Payments > Services**. Set each client's own agreed
   USD price, billing cycle and covered site; there is no shared maintenance price.
5. Use **Communications** for potential and current clients, and **Tasks** for work.
6. **Websites > Editor** opens Breeze's existing separate CMS login.

Marketing, Calls and Orders are removed from the active interface. Any records
previously saved in those modules remain in private backups and exports.

### Track potential and existing client communications

1. Open **Communications > Add person**. Enter the person's name, business, email
   and current conversation stage. A potential client does not need a client or
   website record yet. Link an existing client when appropriate.
2. Open the person and choose **Log email / note**. Record an email you sent, a
   reply received or a note, with the actual date and a short subject/summary.
3. The **Last email sent** date is calculated from your sent-email entries. Replies
   and notes do not change it. Older emails can be logged without moving that date
   backwards. The timeline preserves repeated reminders and project updates.
4. Set the next follow-up date and next action. Due follow-ups appear on Overview,
   the Communications navigation badge and the Follow-ups due filter. When logging
   another email, choose the next reminder date or clear the previous reminder.
5. When a potential client orders, choose **Create client**. Their client and
   primary contact are created once, and the existing conversation/history stays
   together. Continue recording communications during and after the website work.

Email dates come from entries you log manually. This feature does not read your
mailbox or send reminders automatically. **Open email app** opens your own mail
application. Conversation times display in Europe/Skopje; entry inputs use the
computer/browser's local time.

## 2. Configuration files

Create your local configuration from the example:

```powershell
Copy-Item .env.example .env.local
```

Do this once; do not overwrite a file after adding your keys. Restart the dev
server after environment changes. Do not prefix secret keys with `NEXT_PUBLIC_`.

| Variable | Where to set it | Purpose |
| --- | --- | --- |
| `ADMIN_ORIGIN` | Admin local/Vercel | Exact admin browser origin, no trailing slash |
| `ADMIN_ALLOW_LOCAL` | Admin local only | Local development shortcut; production always rejects it |
| `PLATFORM_API_URL` | Admin/Vercel | Cloud Worker HTTPS origin; leave blank for local SQLite |
| `PLATFORM_API_TOKEN` | Admin + Worker secret | Same new server credential on both sides, 32+ characters |
| `CF_ACCESS_TEAM_DOMAIN` | Admin/Vercel | Your `team.cloudflareaccess.com` hostname |
| `CF_ACCESS_AUD` | Admin/Vercel | Audience tag from your Access application |
| `ADMIN_ALLOWED_EMAILS` | Admin/Vercel | Comma-separated authorized owner emails |
| `STRIPE_MODE` | Local admin or Worker | `test` first; `live` when verified |
| `STRIPE_SECRET_KEY` | Local admin or Worker secret | Restricted Stripe read key, or secret API key |
| `STRIPE_WEBHOOK_SECRET` | Local admin or Worker secret | Signing secret for the configured Stripe endpoint |
| `MONITOR_ALLOWED_HOSTS` | Local admin or Worker vars | Exact approved hostnames, comma-separated |
| `CMS_MONITOR_TOKENS_JSON` | Local admin or Worker secret | Site-ID-to-read-only-token JSON object |

Once `PLATFORM_API_URL` is set, the Worker performs Stripe and monitoring work.
Configure those secrets on the Worker, not only in Vercel. API keys never belong
in client records, `site.config.json`, source control or browser code.

## 3. Connect Stripe payment tracking

For the updated step-by-step key instructions, long-term key use, permissions
and the current Payment Link limitation, read [STRIPE-SETUP.md](../STRIPE-SETUP.md)
in the workspace root. A Dashboard-created restricted key has no standard 30-day
renewal requirement; the old-key expiration shown during rotation is separate.
[Stripe key lifecycle](https://docs.stripe.com/keys#rotate-an-api-key)

1. In your own Stripe business account, start in test mode. Payment screens and
   totals track only explicitly linked recurring maintenance subscriptions.
2. Create a restricted read API key using the exact permission table in
   `STRIPE-SETUP.md`: Subscriptions, Invoices (including Invoice Payments),
   Payment Intents and Charges and Refunds are needed for maintenance sync.
   The app only calls Stripe GET APIs. Configure billing in Stripe's dashboard.
3. For local work, put the key in `.env.local` as `STRIPE_SECRET_KEY`, with
   `STRIPE_MODE=test`. For hosted work, put it in the agency Worker secrets.
4. Open the actual maintenance subscription in Stripe and copy its `sub_...` ID.
   In **Payments > Services**, add the client's individual recurring service,
   enter the subscription ID and choose the matching **Stripe environment**.
5. Restart after adding environment keys. Click **Payments > Sync Stripe**.
6. Verify an existing test invoice and payment against Stripe. Check the amount,
   currency, customer and payment/refund status. A paid invoice can include credits
   or an out-of-band payment, so the Transactions view records actual charges.

Import fetches the latest 100 invoices plus up to two older pages per run
for each linked maintenance subscription, then resolves their Invoice Payments,
Payment Intents and captured charges. Subsequent syncs continue older history, then rotate
through it again for reconciliation. Newest records refresh every run. The hosted
Worker also syncs hourly at minute 17. History may take several runs for a large
subscription. Never combine test/live records or different currencies into one total.

The subscription's actual customer is verified on each sync. It can differ from
the customer created by a one-time checkout for the same person. A customer ID
alone does not select a maintenance subscription. One-time charges are excluded
from payment screens, CSV downloads and financial totals; old imported records
remain in private backups/exports. Pending/unpaid invoices need an actual due date
to appear overdue; a service agreement alone does not invent an unpaid invoice.
Local manual syncing works without a webhook. After an upgrade, add each real
subscription ID and confirm its test/live environment before syncing.

### Stripe webhooks

For hosted use, send webhooks directly to:

```text
https://YOUR-AGENCY-WORKER.workers.dev/api/webhooks/stripe
```

This route verifies Stripe signatures and does not require the agency bearer
token. Keep it outside the Cloudflare Access application protecting your admin UI.
Use API/event version **2025-09-30.clover** to match the pinned reader.
In Workbench, create the destination for **Your account**, select **Snapshot**
payloads, then choose **Webhook endpoint**. The current handler reads snapshot
event objects. [Stripe webhook setup](https://docs.stripe.com/webhooks#set-up-your-endpoint)

Select these events:

```text
invoice.created
invoice.updated
invoice.paid
invoice.payment_failed
invoice.voided
invoice.marked_uncollectible
charge.succeeded
charge.updated
charge.refunded
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

Store the endpoint's `whsec_...` signing secret as `STRIPE_WEBHOOK_SECRET` on the
Worker. Repeated events are safe; the handler fetches current Stripe objects so
out-of-order events cannot restore an old payment state. Scheduled sync recovers
missed updates. Disputed charges are also identified during synchronization.

For local testing with the official Stripe CLI:

```powershell
stripe listen --forward-to http://127.0.0.1:3001/api/webhooks/stripe
```

Use the CLI's signing secret locally. Test mode and live mode have different keys,
customer mappings and webhook secrets. Switch them together and verify in Stripe
before relying on live records. This app does not create charges or shut websites
down when a payment fails.

## 4. Enable website health

For local manual checks, ensure `MONITOR_ALLOWED_HOSTS` in `.env.local` contains
the exact public hostname being checked. Restart after changing it.

1. Edit the website record and confirm its deployed HTTPS URL.
2. Set expected page text that identifies the website, such as `Breeze`.
3. Enable monitoring and save.
4. Open **Websites > Health & incidents** and click **Run checks**.

Checks reject redirects. Use the final URL, such as a `www` hostname if that is
where the site redirects. Add that exact hostname to the approved list. Private
IP addresses, credentials in URLs, HTTP and custom ports are rejected.

The deployed Worker checks enabled sites every five minutes. Local development
does not run unattended checks; click Run checks or run `npm run monitor` while
working. The UI refreshes records every minute. Results older than 20 minutes are
stale. Two consecutive failures open an incident; a healthy result resolves it.
Incident notices are visible in the admin. Email/SMS/push alerts are not enabled.
Raw checks are retained for 90 days, with incident history retained separately.

### Connect Breeze CMS diagnostics

The code adds `/api/monitor/status` to Breeze's CMS Worker. It is disabled until a
separate monitoring token is configured and must be deployed before use.

1. Generate a new random token of at least 32 characters. Keep it separate from
   `CMS_WRITE_TOKEN`; the code rejects reusing the write token.
2. From `breeze-web/workers/cms`, set the live monitoring secret:

```powershell
npx wrangler secret put CMS_MONITOR_TOKEN --config wrangler.live.jsonc
```

3. Deploy the reviewed Breeze Worker code using your existing live procedure and
   exact existing resource bindings. This feature needs no database migration.

```powershell
npx wrangler deploy --config wrangler.live.jsonc
```

4. Set `CMS_MONITOR_TOKENS_JSON` in the agency's server secrets to:

```json
{"breeze":"PASTE-THE-SEPARATE-READ-ONLY-TOKEN"}
```

5. Confirm the website's CMS status URL is
   `https://breeze-live-api.nikodola.workers.dev/api/monitor/status`, and approve
   that hostname in the agency monitor's allowed-host list.
6. Run checks. The response checks database/media readiness and pending publication
   delivery. It exposes no drafts, content documents or write capabilities.

For another CMS adapter, return JSON with `version:1`, the registered `siteId`,
`environment:"live"`, `ready:boolean`, `pendingPublications:integer`, and optional
`oldestPendingAt`/`lastSuccessfulDeliveryAt`. Require a separate server token.

## 5. Prepare the cloud agency backend

All commands in this section run from `workers/api` unless stated otherwise.
Create a NEW agency database. Never reuse Breeze's live or test databases.
If you already deployed the agency backend, apply the new migrations with
`npm run migrate:remote` before deploying the updated Worker. Migration 0002 adds
Communications and North Macedonia/USD defaults. Existing service prices and
their currencies are preserved. Migration 0003 adds maintenance subscription and
invoice-payment associations; existing unclassified billing records are retained
and hidden from maintenance totals until correctly linked and resynced. Check
the new service environment field against Stripe. Local SQLite upgrades once.
Migration 0004 adds optional client names and synced subscription schedule fields.
Apply it to hosted D1 before deploying the client information UI. First payment
uses all imported maintenance history; while backfill is incomplete it is labeled
Earliest imported payment. Next expected payment reflects Stripe's last synced
schedule and is not a guarantee that collection will succeed.

```powershell
npm install
npx wrangler login
npx wrangler d1 create website-products-admin
```

Copy the returned database ID into `wrangler.jsonc` in place of
`REPLACE_WITH_YOUR_NEW_AGENCY_DATABASE_ID`. Confirm your account and database name.
Then apply the agency migration:

```powershell
npm run migrate:remote
```

Generate your own 32+ character platform token, for example:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Store it securely; do not paste it into source code. Set Worker secrets using the
interactive prompts:

```powershell
npx wrangler secret put PLATFORM_API_TOKEN
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put CMS_MONITOR_TOKENS_JSON
```

You may omit Stripe/CMS secrets until ready. Set `STRIPE_MODE` and approved monitor
hosts in `wrangler.jsonc`, then:

```powershell
npm run build
npm run deploy
```

The build is a dry run; deploy is the explicit cloud write. Copy the returned
Worker origin for `PLATFORM_API_URL`. Cron schedules are configured in the file.
Select a Cloudflare plan with sufficient D1 queries and Worker limits for your
record volume; large imports perform many reads/writes.

## 6. Deploy the private admin

1. Keep the shared root application in its own Git repository, preserving Breeze's
   independent repository/history. Do not commit `.env.local`, `.data`, exports or backups.
2. In Vercel, import the root application. Set the project root directory to `.`;
   `admin/` is now private local storage and is not a Next.js application.
   Include `src/`, `public/`, root package/config files and `workers/api/migrations/`.
3. Use Node 22, the normal Next.js preset and `npm run build`.
4. Set Vercel environment variables: `PLATFORM_API_URL`, matching
   `PLATFORM_API_TOKEN`, `ADMIN_ORIGIN`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`,
   and `ADMIN_ALLOWED_EMAILS`. Use the exact final HTTPS custom origin for
   `ADMIN_ORIGIN`, with no slash at the end.
5. Create a Cloudflare Access self-hosted application for your admin custom domain.
   Route that domain through Cloudflare to the Vercel project using the exact DNS
   target Vercel provides. Configure an identity provider and allow only your
   owner email. Require MFA in the Access/identity-provider policy.
6. Copy the application's audience (AUD) and team hostname into Vercel. The app
   verifies Access JWT signatures, issuer, audience, expiry, subject and owner
   email. Signing in with another account does not grant access.
7. Redeploy and open the protected custom domain. Verify your authorized login.
   A direct `.vercel.app` URL without an Access token must not expose records.

Production fails closed when owner identity or the persistent backend is missing.
The app's public `/home` routes and private `/admin` route have separate layouts.
The public website remains local-only until a separate launch decision. Public
homepage metadata permits indexing so local Lighthouse audits can test the
intended public behavior; admin/API/contact responses remain noindex.
An Access policy covering the entire admin hostname also covers `/home` on that
hostname. Before publishing the website, configure a public hostname or a properly
scoped Access policy; retain server-side owner checks on `/admin` and private APIs.
The local shortcut is ignored in production, including if its flag is set true.
Do not attempt to use Vercel's local filesystem as the business database.

## 7. Move local records to a fresh cloud database

Create a local JSON export before changing your local backend settings:

```powershell
npm run db:export
```

The command prints the private file path under `backups/`. Then set
`PLATFORM_API_URL` and `PLATFORM_API_TOKEN` in `.env.local` to your new backend.
From the workspace root:

```powershell
npm run db:push -- "C:\FULL\PATH\TO\platform-export.json"
```

Import only accepts a fresh agency database containing the default Breeze seed.
It refuses to overwrite an active business database. Records are imported as an
atomic batch, with an audit entry. Restart the admin and compare clients, sites,
services and tasks. Keep the local database/export until you verify the result.

For a large database exceeding request/batch limits, use a planned D1 import with
a database administrator rather than repeatedly posting the file.

## 8. Add another website

From the workspace root, preview the intended folder and port:

```powershell
npm run site:new -- --id client-two --name "Client Two" --dry-run
```

Create the project by omitting `--dry-run`. Add `--register` while the local admin
is running to create its client/site records. Use `--client EXISTING-CLIENT-ID`
to attach it to an existing client. Registration uses a placeholder URL with
monitoring disabled; update that URL after deployment.

```powershell
npm run site:new -- --id client-two --name "Client Two" --register
npm --prefix client-two-web install
npm --prefix client-two-web run dev
```

The script refuses existing folders, validates IDs, reserves ports 3000/3001,
and selects a free port based on site manifests. Each new site has its own CSS,
content, app, public assets and non-secret `site.config.json`.

The clean starter uses file content. It includes no Breeze customer content,
credentials or visual CMS. Provision a site's own CMS/schema/storage when that
client needs visual editing. Monitoring is independent of CMS capabilities.
Give every site its own hosting project, domains and secrets. Run its build and
verify the client's actual form delivery before launch.

## 9. Backups and restoration

For a local SQLite backup from the workspace root:

```powershell
npm run backup
```

This creates a consistent snapshot under `backups/`, even with WAL enabled. Keep
an additional private copy outside this computer. The admin also offers
**Settings > Export records** and payment CSV exports. JSON preserves all stored
business records; CSV amounts are integer minor units and include currency.

Restore a JSON export to a NEW local file:

```powershell
npm run db:import -- "C:\PATH\export.json" "C:\PATH\restored.sqlite"
```

The restore refuses to overwrite existing files and checks database integrity.
Set `PLATFORM_DB_PATH` in `.env.local` to the new path, clear the cloud URL
if testing locally, and restart. A full SQLite snapshot can also be opened by
pointing `PLATFORM_DB_PATH` at a copy of that snapshot.

For cloud D1 backup, run from `workers/api`:

```powershell
npx wrangler d1 export website-products-admin --remote --output ../../../backups/agency-cloud.sql
```

Create the backups directory first if needed. Restore into a NEW recovery D1
database and verify it before switching the Worker's binding. Keep your configured
secrets separately. Agency backups do not include Breeze's D1/R2 media; maintain
and test those backups independently.

## 10. Checks and known limits

From the root, `npm run check` runs admin types, unit tests and its production
build. After installing Worker dependencies, also run:

```powershell
npm run test:cloud
npm --prefix workers/api run build
npm --prefix breeze-web run cms:check
```

Implementation verification: admin unit tests, local D1 integration, Worker
dry-run bundle and admin build pass. Breeze's new monitoring checks pass. The
existing Breeze suite has three unrelated stale baseline assertions (old editor
labels and the former pre-Housecall-Pro form); see `docs/VERIFICATION.md`.
The Breeze build can be checked with CMS disabled when its local Worker is off.

You requested to inspect the dashboard yourself; visual dashboard QA is left to
you. Live Stripe, owner login, cloud deployment and live monitor integrations
require your keys/accounts and were not exercised against production.

The dashboard displays up to 1,000 records per business list, 500 recent raw checks
and 100 incidents/activity items; exports contain all stored business rows. The
monitor handles up to 100 enabled sites per run. This is a practical agency
foundation; add server pagination and larger job queues as volume grows.

## Official references

- Stripe invoice states: https://docs.stripe.com/invoicing/overview
- Stripe webhooks: https://docs.stripe.com/webhooks
- Cloudflare Access JWT validation: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Cloudflare scheduled handlers: https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
- Cloudflare D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- Vercel project configuration: https://vercel.com/docs/projects/overview
