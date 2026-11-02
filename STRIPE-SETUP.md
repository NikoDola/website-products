# Stripe setup for Website Products

Checked against Stripe documentation and this app's source on 30 October 2026.
This guide covers clients paying your business for websites and maintenance.

## 1. Create a key for long-term use

Use a **Dashboard-created restricted API key** for this app. Stripe's documented
key lifecycle has no standard requirement to renew this key every 30 days. It
can continue working until it is expired, rotated/revoked, or its access is
restricted. This is not a guarantee that a credential can never be disabled.

During **Rotate key**, the **Expiration** selection applies to the OLD key being
replaced. Creating a new key and rotating an existing key are different actions.
Do not schedule an expiration or rotation unless you intend to replace the key.
[Stripe key lifecycle](https://docs.stripe.com/keys#rotate-an-api-key)

1. Sign in to the Stripe account that owns the Breeze payment link.
2. Open [API keys](https://dashboard.stripe.com/apikeys). Start with a sandbox/test
   key to verify the integration, then create a separate live key for real records.
3. Choose **Create restricted key** and name it `website-products-admin-test` or
   `website-products-admin-live`, matching the selected environment.
4. Configure permissions using the table below. Complete Stripe's verification
   and save the key directly in your server configuration. A live restricted key
   starts with `rk_live_`; a test key starts with `rk_test_`.
   [Restricted key creation](https://docs.stripe.com/keys/restricted-api-keys#create-a-restricted-api-key)

Set these seven resources to **Read**, in the same order as your Dashboard list.
This profile covers customer payment tracking and prepares the key for the
planned Payment Link feature.

| Resource, in Dashboard order | Permission | Purpose |
| --- | --- | --- |
| Charges and Refunds | Read | Import actual payments and refund status |
| Customers | Read | Identify and verify the linked Stripe customer |
| Payment Intents | Read | Verify the payment behind each maintenance invoice |
| Invoices (under Billing) | Read | Import invoices and recurring-payment results |
| Subscriptions (under Billing) | Read | Verify the exact maintenance subscription and its customer |
| Checkout Sessions | Read | Prepare for checking checkout attempts for a payment link |
| Payment Links | Read | Prepare for looking up the payment link in your account |

Leave **every other permission at None**. Set **no permissions to Write**. In
particular, Events and Webhook Endpoints, Event Destinations can remain None;
you configure the webhook yourself in the Stripe Dashboard.

Then click **Apply changes** (or **Create key** if creating a new key).
Restricted-key permissions can be edited later on the same key. The current code
reads linked maintenance subscriptions, invoices, Invoice Payments, Payment
Intents and their charges. Checkout Sessions and Payment Links permissions allow
link verification; a general URL-entry feature is still described in section 5.
[Permission configuration](https://docs.stripe.com/keys/restricted-api-keys#assign-permissions)

Save the key when it is first shown. Keep it in the server's secret storage or
local environment file; do not send it in chat, place it in browser code, or
commit it to GitHub.
[Stripe storage guidance](https://docs.stripe.com/keys-best-practices#store-api-keys-securely)

## 2. Configure the app locally

If `PLATFORM_API_URL` is empty, your local admin performs the Stripe requests.
Open `.env.local`. If it does not exist, copy `.env.example` once;
preserve an existing file and its other settings.

For REAL payments, set these values using your actual live restricted key:

```dotenv
STRIPE_MODE=live
STRIPE_SECRET_KEY=rk_live_REPLACE_WITH_YOUR_ACTUAL_KEY
```

The key above is a placeholder. For test records, use `STRIPE_MODE=test` and your
`rk_test_...` key instead. The app rejects a key whose mode does not match.

Restart the admin after changing environment values. From the workspace root:

```powershell
npm run dev
```

Open `http://127.0.0.1:3001/admin`. Manual **Payments > Sync Stripe** works without a
webhook signing secret once a correct customer is linked in the next step.

### Get a webhook signing secret for local development

If `PLATFORM_API_URL` is empty and you run the admin on your computer, use the
[official Stripe CLI](https://docs.stripe.com/cli/install) to forward events.
Sign in from your terminal:

```powershell
stripe login
```

Run ONE listener matching the mode in `.env.local`. For test mode:

```powershell
stripe listen --forward-to http://127.0.0.1:3001/api/webhooks/stripe
```

For live mode and real payment events:

```powershell
stripe listen --live --forward-to http://127.0.0.1:3001/api/webhooks/stripe
```

The listener prints a signing secret beginning with `whsec_`. Save that value in
`.env.local` and restart the admin:

```dotenv
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_THE_LISTENER_SECRET
```

Keep both the listener and admin running while receiving local events. This is
a development connection; section 4 describes ongoing hosted delivery. A
Dashboard endpoint and a CLI listener have different signing secrets, even if
they belong to the same Stripe account. Use the secret for the delivery method
you are actually using.
[Local forwarding](https://docs.stripe.com/webhooks#test-locally-without-a-registered-url),
[matching signing secrets](https://docs.stripe.com/events/manage-webhook-endpoints#check-the-endpoint-secret)

## 3. Track a client's maintenance subscription

1. Open [Stripe Subscriptions](https://dashboard.stripe.com/subscriptions) in the
   correct account and environment. Open the actual maintenance subscription and
   copy its `sub_...` ID. Verify its price and recurring cycle.
2. Under **Payments > Services**, add or edit that client's maintenance service.
   Enter the individual price/currency, recurring cycle and covered websites.
3. Paste the ID into **Stripe maintenance subscription ID** and select its
   **Stripe environment** (`live` for real records). This must match the app's
   `STRIPE_MODE` to be included in a sync.
4. Click **Payments > Sync Stripe**. Inspect **Maintenance payments** under
   Transactions and **Maintenance invoices** under Invoices.

In **Clients > three-dot menu > More info**, see the first maintenance payment
and next expected payment from Stripe's latest synced schedule. The first date
uses all imported history; while backfill is incomplete the label is Earliest
imported payment. Paused/canceled collection is shown without an invented next
charge date. Optional names and assistant/other emails are entered in
**Edit > More information** or the same section when adding a client.

Only explicitly linked recurring services are imported. The subscription's actual
Stripe customer is verified on each sync, even if an earlier one-time checkout
created a different Customer for the same person. A `cus_...` ID alone does not
select a maintenance service. The client customer field is retained for reference.

One-time charges are excluded from payment screens, CSV downloads and financial
totals. Previously imported records remain in private database backups/exports.
Test/live environments remain separate. Linked mappings cannot be reassigned
after their maintenance invoices have been imported; create another service for
a new subscription.

Stripe can create a new Customer during a subscription Payment Link checkout.
[Stripe Payment Link customer behavior](https://docs.stripe.com/payment-links/post-payment#track-payments)

The reader resolves invoice payments through Stripe's Invoice Payments API, then
checks the associated PaymentIntent and captured charge. Invoice credits or
out-of-band settlements do not become Stripe cash received; refunds reduce the
net amount. No charge or subscription is created or changed by the app.
[Stripe invoice/payment relationships](https://docs.stripe.com/changelog/basil/2025-03-31/add-support-for-multiple-partial-payments-on-invoices)

A local service agreement records your terms. It does not start billing or
generate a Stripe invoice. No imported payment means no confirmed payment in the
app; it does not by itself prove that a specific invoice is overdue.

## 4. Receive updates while your computer is off

Use the hosted agency Worker for continuous operation. Follow sections 5 and 6
of [the main setup guide](docs/SETUP.md#5-prepare-the-cloud-agency-backend) for
D1, the backend and the protected admin. A local dev server does not stay online
after your computer shuts down.

When the admin has `PLATFORM_API_URL` set, the Worker performs Stripe requests.
From `workers/api`, store its key using the interactive prompt:

```powershell
npx wrangler secret put STRIPE_SECRET_KEY
```

Set `STRIPE_MODE` in `workers/api/wrangler.jsonc` to match the key. Deploy
the configured Worker using the main guide. The current Worker syncs linked
maintenance subscriptions hourly at minute 17; you can also click Sync Stripe in the admin.

For updates between scheduled syncs, open
[Stripe Workbench > Webhooks](https://dashboard.stripe.com/webhooks) and create an
event destination for **Your account**, using **Snapshot** payloads and API/event
version **2025-09-30.clover**, matching the existing handler. Choose **Webhook
endpoint** and enter your deployed agency endpoint:

```text
https://YOUR-AGENCY-WORKER.workers.dev/api/webhooks/stripe
```

Use the invoice, charge and subscription event list in
[the main guide](docs/SETUP.md#stripe-webhooks). Keep this endpoint publicly
reachable for Stripe, outside the admin's Cloudflare Access login. Copy the
endpoint's `whsec_...` signing secret into the Worker with:

```powershell
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

The signing secret is separate from the API key. Complete a sandbox payment and
confirm delivery and the imported record before using the live configuration.
Use a separate live endpoint/signing secret for live events.
[Stripe webhook registration](https://docs.stripe.com/webhooks#set-up-your-endpoint)

The Stripe CLI forwarding command in the main guide is for local development.
Use a deployed HTTPS endpoint for ongoing hosted delivery.

## 5. What remains for tracking the supplied URL directly

Breeze's supplied URL:
`https://buy.stripe.com/cNi4gzeDO1cV6pq0Rf3gk0f`

On 30 October, read-only Stripe requests verified that this link produced Breeze's
active **$25/month USD** subscription. It used a different Stripe Customer from
the earlier $250 payment. The local app now has a linked maintenance service,
its paid $25 invoice and its successful $25 payment; the $250 charge is excluded
from the maintenance views and totals.

The app currently tracks the subscription using section 3. A general feature
that accepts a Payment Link URL and discovers its subscription is not implemented.

The additional implementation needs to resolve the link's Stripe `plink_...` ID
in your account, associate it with Breeze's service, import its Checkout Sessions
and process signed Checkout Session payment events. Stripe supports listing
sessions with a `payment_link` filter. The URL's public suffix is not the API ID.
[Stripe Checkout Session lookup](https://docs.stripe.com/api/checkout/sessions/list)

The app must verify payment status and match the intended service/customer;
checkout completion alone can still mean payment is processing. Delayed payments
need success/failure handling. For recurring maintenance, later periods continue
through the subscription's invoices and actual payments.
[Payment Link events](https://docs.stripe.com/payment-links/post-payment#track-payments)

The local live-mode configuration and the actual $25 payment were verified on
30 October with read-only Stripe requests. The platform backend URL and webhook
secret are empty; local updates use manual Sync Stripe. Key values were not
printed. The existing PDFs predate this Stripe addendum; use this Markdown guide
for the current maintenance-only workflow and key instructions.
