# Marketing: Current Clients and New Clients

Updated 2 November 2026. This feature runs in the existing root Next.js app.

## Routes and storage

- `/admin/marketing/` and `/admin/marketing/current-clients` show the existing
  historical Marketing directory, with its filters, editing, history and exports.
  `/admin?view=marketing` remains compatible. The label Current Clients does not
  convert these contacts into application clients or change billing.
- `/admin/marketing/new-clients` contains Gmail account cards, Texas location
  search, potential leads, the manual composer, history and suppression list.
- Existing Marketing data remains in `admin/.data/marketing.json`, unchanged by
  this feature. Existing Clients, Communications and Stripe storage are separate.
- New Clients uses `admin/.data/outreach.sqlite`. It creates empty tables only;
  no sample businesses, email accounts or messages are seeded. Tokens are encrypted
  with AES-256-GCM before persistence. Drafts, sent originals and private business
  records are private local data; keep the database and backups out of Git.
- Hosted use requires a persistent Node filesystem and an absolute
  `OUTREACH_DATA_PATH`. Vercel ephemeral filesystems are rejected. The existing
  D1 Worker does not store this database or OAuth tokens. All private routes use
  the existing owner authentication; POST operations also verify origin and
  `x-platform-request`. The OAuth callback instead verifies owner identity,
  one-use expiring state, an HttpOnly browser-binding cookie and PKCE.

## Gmail setup required before connecting

No Gmail OAuth client ID, client secret, redirect URI or outreach encryption key
was configured when implementation began. The connected Gmail plugin in an
assistant session is a separate integration; this application needs its own
Google Cloud OAuth client and each account's consent.

1. In your Google Cloud project, enable the Gmail API. Configure the Google Auth
   Platform Branding and Audience. For personal Gmail accounts, choose External
   with Testing status and add each Gmail account you intend to connect as a test
   user. Under Data Access, add `gmail.send` and `gmail.readonly`.
2. Create an OAuth 2.0 **Web application** client. Register this exact authorized
   redirect URI for local use:
   `http://127.0.0.1:3001/api/outreach/oauth/callback`.
   Open the app at `http://127.0.0.1:3001` when connecting. If you prefer localhost,
   register its exact URI instead and use that host consistently; OAuth cookies
   do not transfer between the two names.
3. Add these values to the existing root `.env.local`, preserving its other
   settings. Never prefix them with `NEXT_PUBLIC_`:

   ```dotenv
   GMAIL_CLIENT_ID=your-web-client-id
   GMAIL_CLIENT_SECRET=your-web-client-secret
   GMAIL_REDIRECT_URI=http://127.0.0.1:3001/api/outreach/oauth/callback
   OUTREACH_ENCRYPTION_KEY=your-64-character-hexadecimal-key
   OUTREACH_TIMEZONE=Europe/Skopje
   OUTREACH_DISCOVERY_ENABLED=false
   ```

4. Generate the encryption key once, locally:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Store it in `.env.local` and a separate secure backup. Replacing this key makes
   existing stored tokens unreadable; restore the original key or reconnect.
5. Restart the existing app using `npm run dev` on port 3001. Open Marketing →
   New Clients and use **Connect sender** or **Connect test receiver**, one
   account at a time. Finish Google's consent screen. Reconnect verifies the
   original account email rather than trusting a login hint.
6. For hosting, use the protected HTTPS admin origin and register its exact
   `/api/outreach/oauth/callback` URI. Cloudflare Access must also protect the
   callback and all `/api/outreach/*` paths while allowing the owner's normal
   browser session to return from Google. Keep token keys server-side.

Sending accounts request `gmail.send` and `gmail.readonly`. Receiver-only
accounts request `gmail.readonly` and cannot send through this app. The read
scope enables exact-message search, reply/DSN inspection and recipient-mailbox
label checks; it does not modify/delete messages or mark them read. Drafts are
stored locally, so Gmail draft-write permissions are unnecessary.

Google classifies `gmail.readonly` as restricted and `gmail.send` as sensitive.
Public or broader distribution requires Google's applicable verification and
security-assessment process; do not assume a personal test configuration is
production-approved. External apps in Testing have short-lived authorizations
(normally seven days for these scopes), so periodic reconnects may be required.
See [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes),
[OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server)
and [app audience/testing](https://support.google.com/cloud/answer/15549945).

## Connection troubleshooting

Start a new connection from the configured callback origin. If the app is opened
on localhost while the callback uses 127.0.0.1, Connect first returns to the
configured app address; click Connect again there. This ensures the HttpOnly
browser-binding cookie reaches the callback. Complete one connection at a time.

The app reports a safe, specific failure reason for expired/browser sessions,
Google-denied access, rejected OAuth credentials/codes, missing scopes, disabled
Gmail API, account restrictions or a server network failure. Google API errors
such as `SERVICE_DISABLED` are mapped to actionable instructions, not copied
verbatim. Fixed reason codes enter the private audit; provider payloads, tokens,
authorization codes and cookies do not. Old banner query parameters are removed
after display. Earlier generic failure banners did not preserve enough evidence
to determine their original cause retrospectively.

## Costs and external services

No paid business-discovery API is enabled or billed by this implementation.

| Service | Required configuration | Cost / limits |
| --- | --- | --- |
| GeoNames location download | None; `npm run locations:import` | Free CC BY 4.0 geographic dataset; imported locally, no per-keystroke API calls |
| Gmail | Google Cloud project, API enabled, OAuth client, consent, encryption key | Low-volume usage is below Google's current daily billing threshold. Gmail sending limits and per-user/project quotas still apply. Scope verification/security assessments can have separate requirements/costs. |
| OpenStreetMap via Overpass | Optional `OUTREACH_DISCOVERY_ENABLED=true` | Public endpoint has no API-key or per-call charge; availability is shared and not guaranteed. This app caps live lookups at 100 per 24 hours, at least 15 seconds apart, with a 24-hour per-location cache. |
| Google Places, optional future alternative | Not implemented/enabled | Requires a billing-enabled Cloud project and API key. At review time, Text Search Enterprise (website fields) lists 1,000 free monthly events, then $35 per 1,000 in the first paid tier. Terms restrict storing Places content; review these before using it for a lead database. Places is not a source of arbitrary public email or Instagram fields. |

Gmail API request counts and **estimated** quota units are recorded per account;
they are not a measurement of all usage in your Cloud project or your provider
bill. Failed attempts can also consume provider quota. Current Google guidance
lists an 80,000,000-unit daily project billing threshold and says billing details
will be announced separately. Verify current policies before wider use:
[Gmail limits](https://developers.google.com/workspace/gmail/api/reference/quota),
[Places pricing](https://developers.google.com/maps/billing-and-pricing/pricing),
[Places storage policies](https://developers.google.com/maps/documentation/places/web-service/policies).

## Texas directory and discovery

`data/texas-locations.json` is a derived, nonprivate GeoNames directory. The
repeatable importer downloads the full US dataset and administrative-county
crosswalk, keeps current Texas populated-place features, excludes historical,
abandoned and destroyed places, validates all 254 county names and records
source hashes and the import timestamp. It does not rely on a city-population
cutoff or a manually written list. It includes cities, towns, CDPs, smaller
communities and named populated-place subdivisions where GeoNames records them.
It does not infer legal incorporation status. A county is the primary GeoNames
county; a city spanning several counties may display only that primary county.
Coverage is not guaranteed complete.

Rebuild this public dataset when needed with `npm run locations:import` (Python
3.9+; Python standard library and Windows' native curl). The import downloads
public geographic data only and never reads application/private records.
See [GeoNames download format/license](https://download.geonames.org/export/dump/readme.txt).

The location picker loads all 9,591 dataset locations into an alphabetical native
select, with a search input directly above it. Scroll through the complete list
without typing; search by name/county to narrow the options. Clearing search
restores every option. The browse API does not use the 30-result autocomplete
limit. This geographic picker is separate from business discovery. **Find HVAC companies**
uses a server-built, Texas-bounded Overpass query within 20 km of the selected
place. Results are nearby directory listings, not proof of service coverage.
Review each website. Public emails/Instagram links are shown only when valid
OSM contact tags exist; missing fields stay empty. This version does not scrape
websites or invent contact details. Manual company entry has been removed from
the UI at the owner's request; enter a recipient directly in the composer to
send a message without creating a lead. Previously saved leads are preserved.
Opening a business website is a normal
external link, not an automatic website fetch by the app.

Enable the free lookup by setting `OUTREACH_DISCOVERY_ENABLED=true` in the server
environment after reviewing its limitations. No API key or billing account is
needed. The feature is button-triggered, not an autocomplete side effect.
Attribute [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
(ODbL); attribution is retained on discovery results and saved OSM leads. For
larger-scale use, arrange an appropriate hosted/self-hosted service rather than
relying on shared public Overpass capacity. See the
[Overpass operator guidance](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html).

Saved leads are deduplicated by public email, website hostname, OSM source ID,
or normalized company name within a location. They remain independent of
Current Clients, the actual Clients table and financial totals.

## Manual sending and monitoring

1. Browse/search Texas locations and inspect discovered business websites, or go
   directly to the message composer. No saved lead/company record is required.
2. The composer shows **Email**, **Caption**, then **Message**. Email is the
   recipient address, Caption becomes the actual email Subject, and only Message
   supports Markdown. Choose the sending account under Send from. Optional
   company/website/Instagram fields are collapsed under Company details.
3. You can enter all three fields separately. For compatibility, an empty message
   with an empty Caption also accepts `**Your caption**` followed by the body, or
   `**recipient@example.com**`, then `**Your caption**`, then the body, with each
   bold parameter on its own line. The parameters are extracted into separate
   fields and excluded from the sent body. A pasted recipient cannot silently
   replace a different address already entered in Email.
4. Basic Markdown supports bold, italic, lists, code and HTTP(S) links. Raw HTML,
   scripts and embedded remote images are not supported. Preview uses the same
   safe renderer as the HTML email. Email is multipart plain text plus HTML,
   with a real UTF-8 encoded Subject header.
5. Save Draft, Preview, then Send. Send opens a recipient/from/subject/body review;
   **Send this email** submits exactly one saved version. There is no scheduler,
   bulk-send endpoint, follow-up automation or AI agent.
6. History appears immediately below the composer. Expand a card for its original
   rendered message and source Markdown. Refresh individual cards or Refresh All
   to inspect replies, failures and authorized test-account labels.

| Status | Evidence |
| --- | --- |
| Draft | Local saved message, never submitted |
| Sent | Gmail returned a send ID, or exact sent-message evidence reconciled an uncertain attempt |
| Replied | A Gmail thread message from the original recipient references this exact Message-ID |
| Bounced | A machine-readable delivery report matches original Message-ID, failed recipient, `Action: failed` and a permanent `5.x.x` status |
| Inbox — verified test account | Exact message and participant headers match in the connected, designated recipient account with `INBOX` label |
| Spam — verified test account | The same recipient-mailbox evidence has `SPAM` label; the card turns red and sending pauses |
| Unknown delivery placement | No currently verified recipient-label evidence; always used for ordinary business recipients |

Reply/delivery state and placement are separate: a normal sent or replied email
still has unknown placement. An authorized test message without `INBOX`/`SPAM`
labels, including one in All Mail/Trash, is also unknown. A disconnected receiver's
last confirmed result is historical; check the card's last-refresh time. The app
never changes labels or moves test messages out of Spam.

Refreshes are manual and best effort. Replies from another address, broken reply
headers, nonstandard delivery failures, reports stored as attachments without
inline DSN data, or mail deleted from the mailbox may not be detected. Bounce
inspection checks up to three pages (300 reports) from mailer-daemon/postmaster
since submission. It does not claim comprehensive delivery tracking. This version
does not interpret replies as opt-outs automatically: add a suppression block
when a business declines. Confirmed bounced addresses are blocked automatically.

Daily sending limits default to **10 per sender**, reset in `OUTREACH_TIMEZONE`
(Europe/Skopje by default), and are adjustable from 1 to 500. They cover only this
system's sends. Pending and uncertain sends reserve allowance conservatively.
SQLite transactions prevent simultaneous windows from exceeding the cap. A
saved version and account/recipient/subject/body fingerprint block repeat sends,
including the same content submitted through a second draft.

If a send times out or its result is uncertain, do not create another copy.
Refresh searches Gmail Sent for the exact Message-ID. An unconfirmed outcome
stays blocked rather than risking a duplicate. A provider rejection is shown
separately. Authentication/permission errors require reconnecting; rate limiting,
one verified Spam test or three confirmed bounces within seven days pause the
sender. **Resume sending** performs an authenticated profile check and is a manual
decision after reviewing the problem. It does not send anything.

Suppression blocks apply to all sending accounts by email or domain (including
subdomains and saved company websites). Record a reason. Removing a block is an
explicit owner action recorded in the audit log. Disconnect erases local tokens
and attempts Google grant revocation while retaining account/message history.
If revocation fails, remove the app in Google account permissions as well.

## Backup and restore

Run `npm run outreach:backup` to save a consistent SQLite snapshot to ignored
`backups/`. This includes messages, leads, account settings, encrypted tokens,
suppression, usage and audit. Keep `OUTREACH_ENCRYPTION_KEY` separately. The
existing platform backup/JSON export and Current Clients JSON backup do not
include New Clients data.

To restore, stop the app and ensure no outreach SQLite connection is open. Keep
the existing database and any `-wal`/`-shm` files together as a rollback copy,
place the chosen consistent backup at the configured path, then restart with
the matching encryption key. Reconnect accounts if grants have since expired
or been revoked. Never restore a database over an active SQLite connection.

## Validation and remaining setup

Automated tests use temporary databases, mocked Gmail/Overpass responses and
synthetic OAuth credentials. They do not send real mail, connect accounts,
change the owner's Marketing/Clients data or enable paid services. Live Gmail
OAuth, sending and mailbox placement require the owner's credentials and account
consent, followed by deliberate test sends. Dashboard visual review remains
with the owner. No deployment is authorized by this implementation.
