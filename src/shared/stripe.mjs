import { PlatformError } from "./entities.mjs";
import { acquireJob, finishJob, now, stmt } from "./platform.mjs";
import { secretEqual } from "./security.mjs";
import { stripeSchedule } from "./client-summary.mjs";

export const STRIPE_VERSION = "2025-09-30.clover";
const iso = seconds => seconds ? new Date(seconds * 1000).toISOString() : null;
const objectId = value => typeof value === "string" ? value : value?.id;
const subscriptionId = invoice => objectId(invoice.parent?.subscription_details?.subscription || invoice.subscription);

function configuration(env) {
  const mode = env.STRIPE_MODE === "live" ? "live" : "test";
  if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY || "")) throw new PlatformError("Add your Stripe read key to the server configuration.", 503);
  if (!env.STRIPE_SECRET_KEY.startsWith(`sk_${mode}_`) && !env.STRIPE_SECRET_KEY.startsWith(`rk_${mode}_`)) throw new PlatformError("Stripe key and STRIPE_MODE do not match.", 503);
  return mode;
}
export async function stripeGet(env, path, params = {}, fetcher = fetch) {
  configuration(env);
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));
  const response = await fetcher(url.href, { method: "GET", redirect: "error", signal: AbortSignal.timeout(20000), headers: {
    Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": STRIPE_VERSION
  } });
  if (!response.ok) throw new PlatformError(`Stripe returned HTTP ${response.status} reading ${path.split("/")[0]}. Check the key's Read permissions and try again.`, 502);
  return response.json();
}
async function agreementFor(db, subscription, mode) {
  if (!subscription) return null;
  const rows = await db.all("SELECT * FROM agreements WHERE stripe_subscription_id=? AND stripe_mode=? AND cadence!='one-time'", [subscription, mode]);
  if (rows.length > 1) throw new PlatformError("This subscription is linked to more than one maintenance service. Resolve its mapping before syncing.", 409);
  return rows[0] || null;
}

export async function storeInvoice(db, invoice, clientId, mode) {
  if (!invoice.id?.startsWith("in_") || Boolean(invoice.livemode) !== (mode === "live")) throw new PlatformError("Stripe invoice environment mismatch.");
  const subscription = subscriptionId(invoice), agreement = await agreementFor(db, subscription, mode);
  if (!agreement || agreement.client_id !== clientId) return null;
  const prior = await db.first("SELECT client_id FROM invoices WHERE mode=? AND stripe_id=?", [mode, invoice.id]);
  if (prior && prior.client_id !== clientId) throw new PlatformError("This invoice is already assigned to another client.", 409);
  await db.batch([stmt(`INSERT INTO invoices(id,client_id,agreement_id,stripe_id,mode,number,description,amount_due,amount_paid,amount_remaining,currency,status,due_at,paid_at,period_start,period_end,hosted_url,synced_at,stripe_subscription_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mode,stripe_id) DO UPDATE SET agreement_id=excluded.agreement_id,number=excluded.number,description=excluded.description,amount_due=excluded.amount_due,amount_paid=excluded.amount_paid,amount_remaining=excluded.amount_remaining,currency=excluded.currency,status=excluded.status,due_at=excluded.due_at,paid_at=excluded.paid_at,period_start=excluded.period_start,period_end=excluded.period_end,hosted_url=excluded.hosted_url,synced_at=excluded.synced_at,stripe_subscription_id=excluded.stripe_subscription_id`,
    `${mode}-${invoice.id}`, clientId, agreement.id, invoice.id, mode, invoice.number || invoice.id,
    invoice.description || invoice.lines?.data?.[0]?.description || agreement.title,
    invoice.amount_due || 0, invoice.amount_paid || 0, invoice.amount_remaining ?? Math.max(0, invoice.amount_due - invoice.amount_paid), invoice.currency, invoice.status || "draft",
    iso(invoice.due_date || (invoice.status === "open" && invoice.collection_method === "charge_automatically" ? invoice.created : null)), iso(invoice.status_transitions?.paid_at), iso(invoice.period_start), iso(invoice.period_end), invoice.hosted_invoice_url || "", now(), subscription)]);
  return { agreement_id: agreement.id, stripe_subscription_id: subscription, stripe_invoice_id: invoice.id };
}

export async function storeCharge(db, charge, clientId, mode, context) {
  if (!charge.id?.startsWith("ch_") || Boolean(charge.livemode) !== (mode === "live")) throw new PlatformError("Stripe payment environment mismatch.");
  const prior = await db.first("SELECT * FROM payments WHERE mode=? AND stripe_id=?", [mode, charge.id]);
  const link = context || prior;
  if (!link?.stripe_invoice_id || !link.stripe_subscription_id || !link.agreement_id) return null;
  const invoice = await db.first("SELECT * FROM invoices WHERE mode=? AND stripe_id=? AND client_id=? AND agreement_id=? AND stripe_subscription_id=?", [mode, link.stripe_invoice_id, clientId, link.agreement_id, link.stripe_subscription_id]);
  if (!invoice) throw new PlatformError("A maintenance payment must belong to its linked subscription invoice.");
  if (prior && (prior.client_id !== clientId || prior.stripe_invoice_id && prior.stripe_invoice_id !== link.stripe_invoice_id)) throw new PlatformError("This Stripe payment is already assigned to another client or invoice.", 409);
  const captured = charge.amount_captured ?? (charge.paid && charge.captured ? charge.amount : 0);
  // An invoice can be paid by credits or out of band; only a captured Stripe
  // charge contributes cash. Never count an entire multi-invoice charge twice.
  if (context?.allocated_amount !== undefined && captured > context.allocated_amount) throw new PlatformError("A payment is allocated across invoices. Review its allocation before importing cash totals.");
  const amount = captured || 0, refunded = Math.min(amount, charge.amount_refunded || 0);
  await db.batch([stmt(`INSERT INTO payments(id,client_id,stripe_id,mode,description,amount,refunded,currency,status,paid_at,receipt_url,disputed,synced_at,agreement_id,stripe_subscription_id,stripe_invoice_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mode,stripe_id) DO UPDATE SET description=excluded.description,amount=excluded.amount,refunded=excluded.refunded,currency=excluded.currency,status=excluded.status,paid_at=excluded.paid_at,receipt_url=excluded.receipt_url,disputed=excluded.disputed,synced_at=excluded.synced_at,agreement_id=excluded.agreement_id,stripe_subscription_id=excluded.stripe_subscription_id,stripe_invoice_id=excluded.stripe_invoice_id`,
    `${mode}-${charge.id}`, clientId, charge.id, mode, invoice.description, amount, refunded, charge.currency,
    charge.disputed ? "disputed" : charge.refunded ? "refunded" : refunded ? "partially-refunded" : charge.paid && charge.captured ? "succeeded" : charge.status || "pending",
    iso(charge.created), charge.receipt_url || "", charge.disputed ? 1 : 0, now(), link.agreement_id, link.stripe_subscription_id, link.stripe_invoice_id)]);
  return { id: `${mode}-${charge.id}` };
}

async function reconcileInvoice(db, env, invoice, agreement, customer, mode, fetcher) {
  if (subscriptionId(invoice) !== agreement.stripe_subscription_id || objectId(invoice.customer) !== customer) throw new PlatformError("Unexpected Stripe subscription or customer identity.");
  const context = await storeInvoice(db, invoice, agreement.client_id, mode);
  if (!context) throw new PlatformError("The maintenance subscription mapping changed. Refresh before syncing.", 409);
  if (invoice.status === "draft") return;
  let after;
  do {
    const list = await stripeGet(env, "invoice_payments", { invoice: invoice.id, limit: 100, starting_after: after }, fetcher);
    for (const payment of list.data) {
      if (Boolean(payment.livemode) !== (mode === "live") || objectId(payment.invoice) !== invoice.id) throw new PlatformError("Unexpected Stripe invoice payment identity.");
      if (payment.status !== "paid" || payment.payment?.type !== "payment_intent") continue;
      const intentId = objectId(payment.payment.payment_intent);
      if (!/^pi_[A-Za-z0-9]+$/.test(intentId || "")) throw new PlatformError("Invalid Stripe invoice payment reference.");
      const intent = await stripeGet(env, `payment_intents/${intentId}`, { "expand[]": "latest_charge" }, fetcher);
      if (intent.id !== intentId || Boolean(intent.livemode) !== (mode === "live") || objectId(intent.customer) !== customer) throw new PlatformError("Unexpected Stripe payment identity.");
      if (!intent.latest_charge) continue;
      const charge = typeof intent.latest_charge === "string" ? await stripeGet(env, `charges/${intent.latest_charge}`, {}, fetcher) : intent.latest_charge;
      if (objectId(charge.customer) !== customer || objectId(charge.payment_intent) !== intentId || charge.currency !== invoice.currency) throw new PlatformError("Unexpected Stripe charge identity.");
      await storeCharge(db, charge, agreement.client_id, mode, { ...context, ...(payment.status === "paid" ? { allocated_amount: payment.amount_paid } : {}) });
    }
    if (list.has_more && !list.data.length) throw new PlatformError("Stripe returned an incomplete payment page. Retry synchronization.", 502);
    after = list.has_more ? list.data.at(-1).id : undefined;
  } while (after);
}

async function readSubscription(db, env, agreement, mode, fetcher) {
  const subscription = await stripeGet(env, `subscriptions/${agreement.stripe_subscription_id}`, {}, fetcher);
  if (subscription.id !== agreement.stripe_subscription_id || Boolean(subscription.livemode) !== (mode === "live") || !/^cus_[A-Za-z0-9]+$/.test(objectId(subscription.customer) || "")) throw new PlatformError("Unexpected Stripe subscription identity.");
  const schedule = stripeSchedule(subscription);
  await db.batch([stmt("UPDATE agreements SET stripe_status=?,stripe_next_payment_at=?,stripe_schedule_note=?,stripe_synced_at=? WHERE id=? AND stripe_subscription_id=? AND stripe_mode=?", schedule.status, schedule.nextPaymentAt, schedule.note, now(), agreement.id, subscription.id, mode)]);
  return subscription;
}
async function importSubscription(db, env, agreement, mode, fetcher) {
  const subscription = await readSubscription(db, env, agreement, mode, fetcher);
  const customer = objectId(subscription.customer);
  const jobId = `maintenance-${mode}-${agreement.id}-${agreement.stripe_subscription_id}`;
  await db.batch([stmt("INSERT OR IGNORE INTO jobs(id) VALUES(?)", jobId)]);
  const job = await db.first("SELECT cursor FROM jobs WHERE id=?", [jobId]);
  const ingest = async params => {
    const list = await stripeGet(env, "invoices", { customer, subscription: subscription.id, limit: 100, ...params }, fetcher);
    for (const invoice of list.data) await reconcileInvoice(db, env, invoice, agreement, customer, mode, fetcher);
    if (list.has_more && !list.data.length) throw new PlatformError("Stripe returned an incomplete invoice page. Retry synchronization.", 502);
    return list;
  };
  let list = await ingest({}), cursor = job.cursor;
  if (!cursor || cursor === "complete") cursor = list.has_more ? list.data.at(-1).id : "complete";
  for (let page = 0; page < 2 && cursor !== "complete"; page++) {
    list = await ingest({ starting_after: cursor });
    cursor = list.has_more ? list.data.at(-1).id : "complete";
  }
  await db.batch([stmt("UPDATE jobs SET cursor=?,last_success_at=?,error=NULL WHERE id=?", cursor, now(), jobId)]);
}
export async function syncStripe(db, env, fetcher = fetch) {
  const mode = configuration(env);
  if (!await acquireJob(db, `stripe-${mode}`, 840)) throw new PlatformError("Stripe synchronization is already running.", 409);
  try {
    const agreements = await db.all("SELECT * FROM agreements WHERE stripe_subscription_id!='' AND stripe_mode=? AND cadence!='one-time' ORDER BY id", [mode]);
    if (!agreements.length) throw new PlatformError(`Add a maintenance service with its Stripe subscription ID and ${mode} environment under Payments > Services before syncing.`);
    for (const agreement of agreements) await importSubscription(db, env, agreement, mode, fetcher);
    await finishJob(db, `stripe-${mode}`);
    return { clients: new Set(agreements.map(agreement => agreement.client_id)).size, subscriptions: agreements.length, mode };
  } catch (error) {
    await finishJob(db, `stripe-${mode}`, error instanceof PlatformError ? error.message : "Maintenance synchronization failed. Check Read permissions and retry.");
    throw error;
  }
}

export async function verifyStripeSignature(body, signature, secret, time = Date.now()) {
  if (!secret || secret.length < 20 || !signature || body.length > 1024 * 1024) return false;
  const parts = signature.split(",").map(part => part.split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(time / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = [...new Uint8Array(signatureBytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  for (const [name, candidate] of parts) if (name === "v1" && await secretEqual(candidate, expected)) return true;
  return false;
}
export async function handleWebhook(db, env, body, signature, fetcher = fetch) {
  if (!await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET)) throw new PlatformError("Invalid Stripe signature.", 400);
  let event;
  try { event = JSON.parse(body); } catch { throw new PlatformError("Invalid webhook JSON."); }
  const mode = env.STRIPE_MODE === "live" ? "live" : "test";
  if (Boolean(event.livemode) !== (mode === "live")) throw new PlatformError("Stripe webhook environment mismatch.");
  if (!/^evt_[A-Za-z0-9]+$/.test(event.id || "")) throw new PlatformError("Invalid Stripe event ID.");
  const prior = await db.first("SELECT status FROM webhook_events WHERE id=?", [event.id]);
  if (prior?.status === "processed") return { received: true, duplicate: true };
  await db.batch([stmt("INSERT OR IGNORE INTO webhook_events(id,type,mode,status,received_at) VALUES(?,?,?,'pending',?)", event.id, event.type || "unknown", mode, now())]);
  const object = event.data?.object;
  if (["invoice", "charge", "subscription"].includes(object?.object) && object?.id) {
    if (!await acquireJob(db, `stripe-${mode}`, 120)) throw new PlatformError("Stripe synchronization is busy. Retry this event.", 503);
    try {
      if (object.object === "invoice") {
        const invoice = await stripeGet(env, `invoices/${object.id}`, {}, fetcher);
        const agreement = await agreementFor(db, subscriptionId(invoice), mode);
        if (agreement) {
          const subscription = await readSubscription(db, env, agreement, mode, fetcher);
          await reconcileInvoice(db, env, invoice, agreement, objectId(subscription.customer), mode, fetcher);
        }
      } else if (object.object === "subscription") {
        const agreement = await agreementFor(db, object.id, mode);
        if (agreement) await importSubscription(db, env, agreement, mode, fetcher);
      } else {
        const charge = await stripeGet(env, `charges/${object.id}`, {}, fetcher);
        const known = await db.first("SELECT * FROM payments WHERE mode=? AND stripe_id=? AND stripe_subscription_id!=''", [mode, charge.id]);
        const agreement = known ? await agreementFor(db, known.stripe_subscription_id, mode) : null;
        if (agreement) {
          const subscription = await readSubscription(db, env, agreement, mode, fetcher);
          if (objectId(charge.customer) !== objectId(subscription.customer)) throw new PlatformError("Unexpected Stripe customer identity.");
          await storeCharge(db, charge, agreement.client_id, mode);
        } else if (objectId(charge.payment_intent)) {
          // Clover links charges to invoices through Invoice Payments, not the
          // removed charge.invoice field. Never assign a charge by email.
          const links = await stripeGet(env, "invoice_payments", { "payment[type]": "payment_intent", "payment[payment_intent]": objectId(charge.payment_intent), limit: 100 }, fetcher);
          if (links.has_more) throw new PlatformError("Invoice payment links need pagination. Retry using manual maintenance sync.", 503);
          for (const payment of links.data) {
            const invoice = await stripeGet(env, `invoices/${objectId(payment.invoice)}`, {}, fetcher);
            const linked = await agreementFor(db, subscriptionId(invoice), mode);
            if (linked) {
              const subscription = await readSubscription(db, env, linked, mode, fetcher);
              await reconcileInvoice(db, env, invoice, linked, objectId(subscription.customer), mode, fetcher);
            }
          }
        }
      }
      await finishJob(db, `stripe-${mode}`);
    } catch (error) { await finishJob(db, `stripe-${mode}`, "A maintenance webhook could not be reconciled. Stripe will retry."); throw error; }
  }
  await db.batch([stmt("UPDATE webhook_events SET status='processed',processed_at=? WHERE id=?", now(), event.id)]);
  return { received: true };
}
