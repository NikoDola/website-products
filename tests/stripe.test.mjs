import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { database } from "./helpers.mjs";
import { storeInvoice, storeCharge, syncStripe, verifyStripeSignature, handleWebhook } from "../src/shared/stripe.mjs";
import { saveRecord, snapshot, stmt } from "../src/shared/platform.mjs";

const env = { STRIPE_MODE: "test", STRIPE_SECRET_KEY: "rk_test_Example123", STRIPE_WEBHOOK_SECRET: "whsec_" + "x".repeat(40) };
const subscription = { id: "sub_Maintenance", object: "subscription", customer: "cus_Subscription", livemode: false, status: "active", collection_method: "charge_automatically", items: { data: [{ current_period_end: 1800000000 }] } };
const charge = (extra = {}) => ({ id: "ch_example", object: "charge", customer: "cus_Subscription", payment_intent: "pi_example", livemode: false, description: "Subscription creation", amount: 2500, amount_captured: 2500, amount_refunded: 0, currency: "usd", status: "succeeded", paid: true, captured: true, created: Math.floor(Date.now() / 1000), ...extra });
const invoice = (extra = {}) => ({ id: "in_example", object: "invoice", customer: "cus_Subscription", livemode: false, parent: { type: "subscription_details", subscription_details: { subscription: subscription.id } }, number: "MAINT-001", amount_due: 2500, amount_paid: 2500, amount_remaining: 0, currency: "usd", status: "paid", status_transitions: { paid_at: Math.floor(Date.now() / 1000) }, ...extra });
async function linked(db) {
  const client = await db.first("SELECT * FROM clients WHERE id='breeze-client'");
  // The old one-time checkout has a DIFFERENT customer from the subscription.
  await saveRecord(db, "clients", { id: client.id, version: client.version, name: client.name, stripe_test_id: "cus_OneTime" }, "owner");
  return saveRecord(db, "agreements", { id: "maintenance", client_id: client.id, title: "Website maintenance", amount: 2500, currency: "usd", cadence: "monthly", stripe_subscription_id: subscription.id, stripe_mode: "test" }, "owner");
}
const signed = (body, time = Math.floor(Date.now() / 1000)) => `t=${time},v1=${createHmac("sha256", env.STRIPE_WEBHOOK_SECRET).update(`${time}.${body}`).digest("hex")}`;
const event = (id, object, type = "charge.updated") => JSON.stringify({ id, type, livemode: false, data: { object } });
function reader({ refunded = 0, older = false, badCustomer = false } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    assert.equal(options.method, "GET");
    const target = new URL(url); calls.push(target);
    assert.equal(target.hostname, "api.stripe.com");
    const path = target.pathname.replace("/v1/", "");
    if (path === `subscriptions/${subscription.id}`) return Response.json(subscription);
    if (path === "invoices") {
      assert.equal(target.searchParams.get("subscription"), subscription.id);
      assert.equal(target.searchParams.get("customer"), "cus_Subscription");
      const old = target.searchParams.has("starting_after");
      return Response.json({ data: [invoice({ id: old ? "in_old" : "in_example", ...(badCustomer ? { customer: "cus_Wrong" } : {}) })], has_more: older && !old });
    }
    if (path.startsWith("invoices/")) return Response.json(invoice({ id: path.split("/")[1] }));
    if (path === "invoice_payments") {
      const old = target.searchParams.get("invoice") === "in_old";
      return Response.json({ data: [{ id: old ? "inpay_old" : "inpay_example", livemode: false, invoice: old ? "in_old" : "in_example", status: "paid", amount_paid: 2500, payment: { type: "payment_intent", payment_intent: old ? "pi_old" : "pi_example" } }], has_more: false });
    }
    if (path.startsWith("payment_intents/")) {
      const old = path.endsWith("pi_old");
      return Response.json({ id: old ? "pi_old" : "pi_example", customer: "cus_Subscription", livemode: false, latest_charge: charge({ id: old ? "ch_old" : "ch_example", payment_intent: old ? "pi_old" : "pi_example", amount_refunded: refunded, refunded: refunded === 2500 }) });
    }
    if (path === "charges/ch_example") return Response.json(charge({ amount_refunded: refunded, refunded: refunded === 2500 }));
    throw new Error(`Unexpected Stripe request: ${path}`);
  };
  return { calls, fetcher };
}

test("maintenance sync follows the selected subscription customer and excludes the $250 one-time payment from records and totals", async () => {
  const db = await database(); await linked(db);
  const at = new Date().toISOString();
  await db.batch([stmt("INSERT INTO payments(id,client_id,stripe_id,mode,amount,currency,status,paid_at,synced_at) VALUES('old','breeze-client','ch_oneTime','test',25000,'usd','succeeded',?,?)", at, at)]);
  const { calls, fetcher } = reader();
  const result = await syncStripe(db, env, fetcher);
  assert.equal(result.subscriptions, 1); assert.equal(result.clients, 1);
  const data = await snapshot(db, env);
  assert.equal(data.invoices.length, 1); assert.equal(data.invoices[0].amount_paid, 2500);
  assert.equal(data.payments.length, 1); assert.equal(data.payments[0].amount, 2500);
  assert.equal(data.payments[0].stripe_subscription_id, subscription.id);
  assert.equal(data.summary.received[0].amount, 2500);
  assert.equal(data.agreements[0].stripe_next_payment_at, new Date(1800000000 * 1000).toISOString());
  assert.ok(data.client_billing[0].first_payment_at);
  assert.equal((await db.all("SELECT * FROM payments")).length, 2, "old records remain available for private exports");
  assert.ok(!calls.some(url => url.pathname === "/v1/charges"), "never import every customer charge");
  assert.equal((await snapshot(db, { STRIPE_MODE: "live" })).payments.length, 0);
  db.raw.close();
});

test("invoice credits are not cash; one-time invoices and charges are ignored, while refunds update once", async () => {
  const db = await database(); await linked(db);
  assert.equal(await storeInvoice(db, invoice({ parent: null }), "breeze-client", "test"), null);
  assert.equal(await storeCharge(db, charge(), "breeze-client", "test"), null);
  const context = await storeInvoice(db, invoice({ amount_due: 0, amount_paid: 0 }), "breeze-client", "test");
  assert.equal((await db.all("SELECT * FROM payments")).length, 0);
  await storeCharge(db, charge(), "breeze-client", "test", context);
  await storeCharge(db, charge({ amount_refunded: 500 }), "breeze-client", "test", context);
  const data = await snapshot(db, env);
  assert.equal(data.payments.length, 1); assert.equal(data.payments[0].status, "partially-refunded");
  assert.equal(data.summary.received[0].amount, 2000);
  await assert.rejects(storeCharge(db, charge(), "breeze-client", "live", context), /environment/);
  await assert.rejects(storeCharge(db, charge(), "breeze-client", "test", { ...context, allocated_amount: 1000 }), /allocated across invoices/);
  db.raw.close();
});

test("subscription history paginates, repeat syncs upsert, and current invoices refresh refunds", async () => {
  const db = await database(); await linked(db);
  const { calls, fetcher } = reader({ older: true });
  await syncStripe(db, env, fetcher); await syncStripe(db, env, fetcher);
  assert.equal(calls.filter(url => url.pathname === "/v1/invoices").length, 4);
  assert.equal((await db.all("SELECT * FROM invoices")).length, 2);
  assert.equal((await db.all("SELECT * FROM payments")).length, 2);
  await syncStripe(db, env, reader({ refunded: 2500, older: true }).fetcher);
  assert.equal((await snapshot(db, env)).summary.received[0].amount, 0);
  await assert.rejects(syncStripe(db, { ...env, STRIPE_MODE: "live" }, fetcher), /do not match/);
  db.raw.close();
});

test("an open or canceled invoice payment and an invoice paid without a Stripe charge never count as received cash", async () => {
  for (const status of ["open", "canceled", "no-stripe-payment"]) {
    const db = await database(); await linked(db);
    const base = reader();
    const fetcher = async (url, options) => {
      if (new URL(url).pathname === "/v1/invoice_payments") return Response.json({ data: status === "no-stripe-payment" ? [] : [{ id: "inpay_waiting", livemode: false, invoice: "in_example", status, payment: { type: "payment_intent", payment_intent: "pi_example" } }], has_more: false });
      return base.fetcher(url, options);
    };
    await syncStripe(db, env, fetcher);
    const data = await snapshot(db, env);
    assert.equal(data.invoices[0].status, "paid");
    assert.equal(data.payments.length, 0); assert.deepEqual(data.summary.received, []);
    db.raw.close();
  }
});

test("signed webhooks reconcile current maintenance charges, reject old signatures and deduplicate", async () => {
  const db = await database(); await linked(db);
  const context = await storeInvoice(db, invoice(), "breeze-client", "test");
  await storeCharge(db, charge(), "breeze-client", "test", context);
  const body = event("evt_Example", charge(), "charge.succeeded");
  assert.equal(await verifyStripeSignature(body, signed(body), env.STRIPE_WEBHOOK_SECRET), true);
  assert.equal(await verifyStripeSignature(body, signed(body, 1), env.STRIPE_WEBHOOK_SECRET), false);
  await assert.rejects(handleWebhook(db, env, body, "bad"), /signature/);
  const { calls, fetcher } = reader({ refunded: 2500 });
  await handleWebhook(db, env, body, signed(body), fetcher);
  const duplicate = await handleWebhook(db, env, body, signed(body), fetcher);
  assert.equal(calls.length, 2); assert.equal(duplicate.duplicate, true);
  assert.equal((await db.first("SELECT status FROM payments")).status, "refunded");
  const old = event("evt_Old", charge());
  await handleWebhook(db, env, old, signed(old), fetcher);
  assert.equal((await db.first("SELECT status FROM payments")).status, "refunded");
  db.raw.close();
});

test("new charge webhooks resolve Clover Invoice Payments without relying on charge.invoice", async () => {
  const db = await database(); await linked(db);
  const body = event("evt_NewCharge", charge(), "charge.succeeded");
  const { calls, fetcher } = reader();
  await handleWebhook(db, env, body, signed(body), fetcher);
  assert.ok(calls.some(url => url.pathname === "/v1/invoice_payments" && url.searchParams.get("payment[payment_intent]") === "pi_example"));
  assert.equal((await snapshot(db, env)).payments[0].amount, 2500);
  db.raw.close();
});

test("sync requires an explicit maintenance subscription and rejects cross-customer invoices", async () => {
  const db = await database();
  await assert.rejects(syncStripe(db, env), /Add a maintenance service/);
  await linked(db);
  await assert.rejects(syncStripe(db, env, reader({ badCustomer: true }).fetcher), /identity/);
  assert.equal((await db.all("SELECT * FROM payments")).length, 0);
  assert.equal((await db.all("SELECT * FROM invoices")).length, 0);
  db.raw.close();
});

test("maintenance mappings are unique by environment and frozen once invoices exist", async () => {
  const db = await database(); await linked(db);
  await assert.rejects(saveRecord(db, "agreements", { client_id: "breeze-client", title: "Duplicate", stripe_subscription_id: subscription.id, stripe_mode: "test" }, "owner"), /already linked/);
  const context = await storeInvoice(db, invoice(), "breeze-client", "test");
  await storeCharge(db, charge(), "breeze-client", "test", context);
  const client = await db.first("SELECT * FROM clients WHERE id='breeze-client'");
  await assert.rejects(saveRecord(db, "clients", { id: client.id, version: client.version, name: client.name, stripe_test_id: "cus_Another" }, "owner"), /imported/);
  const service = await db.first("SELECT * FROM agreements WHERE id='maintenance'");
  await assert.rejects(saveRecord(db, "agreements", { id: service.id, version: service.version, client_id: service.client_id, title: service.title, stripe_mode: "test", stripe_subscription_id: "sub_Another" }, "owner"), /imported invoices/);
  db.raw.close();
});
