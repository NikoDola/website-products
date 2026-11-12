# Referral Program

Open **Marketing > Referral Program**, or
`http://127.0.0.1:3001/admin/marketing/referral-program` while running `npm run dev`.

## People, codes and flyers

1. Select **Add person**. Enter the referring person's name and agreed percentage.
   Email, phone and payment instructions are optional. Record a payee name and
   payment destination so you know where to send their commission. Keep passwords,
   card security codes and account login details out of these instructions.
2. The percentage applies only to the referred customer's **first website
   payment**, as selected by the owner. Enter the actual agreed percentage for
   each person. The basis is fixed; there is no automatic Stripe import or
   automatic determination of which payment is the first.
3. Saving creates one permanent random code such as `REF-A123456789BC` for that
   person. Editing their name, rate or contact details preserves the code.
4. Open **QR & flyer**. Download the **named QR SVG** to place inside your own
   flyer, or download the complete **flyer SVG**. Both contain the referring
   person's name and code below the QR symbol. SVG files scale for printing.
   Leave the white margin around the QR symbol intact, and scan the final printed
   design before distributing it.

QR images are generated locally with the pinned `qrcode` dependency. No QR image
service receives partner data. The downloads contain the public partner name,
code and website address; payment instructions, contacts and commission rates
stay in the private admin. Changing a name updates future downloads; existing
printed flyers still identify the same partner through the permanent code.

## Website attribution

Each QR encodes `/home?ref=CODE#contact` at the configured website origin. The
English/Macedonian enquiry form has an optional referral code field, prefilled
from that link. Visitors can also type or paste a code. Language switching and
the website's wordmark preserve the code. A native form submission without
JavaScript preserves it when returning with feedback.

On submission, the server resolves the code against an active partner. It saves
the partner ID, name and code with the enquiry, ignoring any submitted partner ID
or name. Unknown/inactive codes must be corrected or cleared before submission;
a referral storage failure reports an error instead of silently dropping credit.
The visitor receives no partner payment details. Marking a person inactive stops
new referrals and commissions while retaining past records and codes.

Referred enquiries appear in **Referral Program > Referred enquiries**, with the
customer's email, message and referring person. They are also included in
`npm run home:inbox` and the private inbox JSON export. Existing enquiries retain
their text and consent history and have empty referral attribution.

Attribution applies to the submitted form code. There are no scan counts,
cross-visit tracking cookies, email-link attribution or automatic client matching.
If a customer contacts you another way, record their commission manually after
confirming which person referred them.

## Commission owed and paid

Use **Record commission** beside a person, or beside a referred enquiry after
confirming their first website payment. Enter the referred customer, that amount,
currency, and a unique invoice/receipt/payment reference. The app calculates the
commission using that person's current percentage and copies the rate and basis
into the entry. It rounds to the nearest minor unit, with halves rounded up.
USD, EUR, GBP and MKD balances remain separate; no exchange-rate conversion occurs.

Example: a confirmed first website payment of USD 500 at 10% creates USD 50
**owed**. An enquiry alone creates nothing owed. Before recording the commission,
check **I have confirmed this is the customer's first website payment**. The
server requires that confirmation and saves it in the audit snapshot. Later
instalments and maintenance payments earn no commission. The owner verifies the
payment history manually; the app does not determine it through Stripe.

An existing payment reference cannot be reused, including with another partner,
and duplicate submissions cannot create a second commission for the same enquiry.
The enquiry shortcut links one non-void commission. Use the person's **Record
commission** action for another referred customer's first website payment.
Existing entries keep their original rate when you change a person's percentage.
Stale edits are rejected instead of overwriting another save. Earlier basis
labels remain readable in history; all new commissions use first website payment.

After transferring the money yourself, select **Mark paid** and enter the actual
payout reference. Confirming stores the date and reference; it does not send money.
An unpaid entry entered in error can be **voided**. Void records and prior versions
remain in audit history. Paid entries are final in this interface; corrections
require a reviewed data repair. No referral entry affects Stripe, Clients,
Communications, historical Marketing, or maintenance payment totals.

## Local setup and public printing

The feature works locally without external credentials. Storage starts empty at
`admin/.data/referrals.sqlite`, independent of the other databases. The website
inbox stays at `admin/.data/home-inquiries.sqlite`. No partners, test customers,
commissions or payments are seeded.

Until `HOME_PUBLIC_ORIGIN` is configured, QR previews use this computer's exact
supported loopback address on port 3001 and display a warning. Someone else's
phone cannot reach this computer through a `127.0.0.1`/`localhost` QR link.
Before distributing flyers, configure the eventual public HTTPS website origin
with no path or trailing slash, host the website and its submission endpoint,
then regenerate and test every download. Do not print the admin URL or assume
that downloading a flyer publishes the website. This implementation does not
deploy or change hosting.

Production requires a persistent Node server with owner authentication, the
existing admin mutation origin checks, and:

```dotenv
REFERRAL_DATA_PATH=/persistent/private/referrals.sqlite
HOME_INQUIRIES_DATA_PATH=/persistent/private/home-inquiries.sqlite
HOME_PUBLIC_ORIGIN=https://your-public-domain.example
```

The public form process and private admin must read the same referral database
and inquiry inbox. A configured relative local referral path retains the existing
admin-relative storage convention. Production requires absolute paths. Referral
storage rejects Vercel; the existing Cloudflare Worker/D1 backend does not store
this independent SQLite file. Existing contact-form origin/rate checks still apply.

## Private backup

**Referral Program > JSON backup** exports all partners, commissions, before/after
audit entries and referred enquiries. Keep this file private: it includes contact
details and payment instructions. It is a separate backup from historical
Marketing JSON, SQLite/D1 platform exports and `npm run backup`.

The JSON download is an export; no JSON import or one-click restore is provided.
For a full directly restorable backup, use a SQLite-aware backup of both
`referrals.sqlite` and the separate inquiry inbox, or stop every writer before
copying the database and any WAL files. Preserve the current files before a
reviewed restoration. Never publish these files or put them in `public/`.

## Verification

Run `node --test tests/referrals.test.mjs tests/home.test.mjs tests/marketing-navigation.test.mjs`,
`npm run typecheck`, `npm test` and `npm run build` from the root. Tests use only
temporary databases. Root development remains on `npm run dev` at port 3001.
