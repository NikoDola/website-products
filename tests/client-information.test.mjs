import test from "node:test";
import assert from "node:assert/strict";
import { database } from "./helpers.mjs";
import { saveRecord, snapshot } from "../src/shared/platform.mjs";
import { dispatch } from "../src/shared/router.mjs";
import { importFresh } from "../src/shared/import.mjs";
import { monthlyPricing, stripeSchedule } from "../src/shared/client-summary.mjs";

test("optional client names and assistant emails persist together; basic clients need no additional contacts", async () => {
  const db = await database();
  const basic = await saveRecord(db, "clients", { name: "Basic Company" }, "owner");
  assert.equal((await db.first("SELECT first_name FROM clients WHERE id=?", [basic.id])).first_name, "");
  assert.equal((await db.all("SELECT * FROM contacts WHERE client_id=?", [basic.id])).length, 0);
  const created = await saveRecord(db, "clients", { name: "Client Company", first_name: "Alex", last_name: "Taylor", additional_contacts: [{ email: "assistant@example.com", role: "Assistant" }, { name: "Billing Person", email: "billing@example.com", phone: "123" }] }, "owner");
  const data = await snapshot(db, {}), client = data.clients.find(row => row.id === created.id);
  assert.equal(client.first_name, "Alex"); assert.equal(client.last_name, "Taylor");
  assert.equal(data.contacts.filter(row => row.client_id === created.id).length, 2);
  assert.equal(data.contacts.find(row => row.role === "Assistant").name, "assistant@example.com");
  await assert.rejects(saveRecord(db, "clients", { name: "Invalid", additional_contacts: [{ email: "invalid" }] }, "owner"), /email/i);
  assert.equal(await db.first("SELECT id FROM clients WHERE name='Invalid'"), null);
  db.raw.close();
});

test("editing optional contacts preserves unseen contacts, supports explicit removal and rejects other clients' contacts", async () => {
  const db = await database();
  const created = await saveRecord(db, "clients", { name: "Company", additional_contacts: [{ name: "Assistant", email: "assistant@example.com" }] }, "owner");
  let client = await db.first("SELECT * FROM clients WHERE id=?", [created.id]);
  let contact = await db.first("SELECT * FROM contacts WHERE client_id=?", [created.id]);
  await saveRecord(db, "clients", { id: client.id, version: client.version, name: "Renamed" }, "owner");
  assert.equal((await db.all("SELECT * FROM contacts WHERE client_id=?", [created.id])).length, 1);
  client = await db.first("SELECT * FROM clients WHERE id=?", [created.id]);
  await saveRecord(db, "clients", { id: client.id, version: client.version, name: client.name, additional_contacts: [{ id: contact.id, version: contact.version, name: "Updated Assistant", email: "new-assistant@example.com", role: "Assistant" }] }, "owner");
  client = await db.first("SELECT * FROM clients WHERE id=?", [created.id]);
  contact = await db.first("SELECT * FROM contacts WHERE id=?", [contact.id]);
  assert.equal(contact.email, "new-assistant@example.com");
  const other = await saveRecord(db, "clients", { name: "Other Company" }, "owner");
  const otherClient = await db.first("SELECT * FROM clients WHERE id=?", [other.id]);
  await assert.rejects(saveRecord(db, "clients", { id: other.id, version: otherClient.version, name: "Unsafe", additional_contacts: [{ id: contact.id, version: contact.version, name: "Wrong" }] }, "owner"), /another client/);
  await saveRecord(db, "clients", { id: client.id, version: client.version, name: client.name, additional_contacts: [{ id: contact.id, version: contact.version, deleted: true }] }, "owner");
  assert.equal(await db.first("SELECT id FROM contacts WHERE id=?", [contact.id]), null);
  assert.equal((await db.first("SELECT name FROM clients WHERE id=?", [other.id])).name, "Other Company");
  db.raw.close();
});

test("a concurrent contact edit rolls back the entire client edit rather than overwriting contact details", async () => {
  const db = await database();
  const created = await saveRecord(db, "clients", { name: "Original", additional_contacts: [{ name: "Assistant", email: "assistant@example.com" }] }, "owner");
  const client = await db.first("SELECT * FROM clients WHERE id=?", [created.id]);
  const contact = await db.first("SELECT * FROM contacts WHERE client_id=?", [created.id]);
  const batch = db.batch.bind(db);
  db.batch = async statements => {
    db.batch = batch;
    await db.run("UPDATE contacts SET name='Concurrent edit',version=version+1 WHERE id=?", [contact.id]);
    return batch(statements);
  };
  await assert.rejects(saveRecord(db, "clients", { id: client.id, version: client.version, name: "Should roll back", additional_contacts: [{ id: contact.id, version: contact.version, name: "Stale contact", email: contact.email }] }, "owner"), /changed/);
  assert.equal((await db.first("SELECT name FROM clients WHERE id=?", [client.id])).name, "Original");
  assert.equal((await db.first("SELECT name FROM contacts WHERE id=?", [contact.id])).name, "Concurrent edit");
  db.raw.close();
});

test("client names and additional contacts survive export and restore", async () => {
  const source = await database(), target = await database();
  const created = await saveRecord(source, "clients", { name: "Export Client", first_name: "Alex", last_name: "Taylor", additional_contacts: [{ name: "Assistant", email: "assistant@example.com" }] }, "owner");
  const exported = await (await dispatch(new Request("https://platform.example/api/export"), source, {}, "owner")).json();
  await importFresh(target, exported, "owner");
  assert.equal((await target.first("SELECT last_name FROM clients WHERE id=?", [created.id])).last_name, "Taylor");
  assert.equal((await target.first("SELECT email FROM contacts WHERE client_id=?", [created.id])).email, "assistant@example.com");
  source.raw.close(); target.raw.close();
});

test("monthly pricing groups currencies and normalizes quarterly/yearly active maintenance only", () => {
  const service = (amount, cadence, currency = "usd", status = "active") => ({ amount, cadence, currency, status });
  assert.deepEqual(monthlyPricing([service(2500, "monthly")]), [{ currency: "usd", amount: 2500 }]);
  assert.deepEqual(monthlyPricing([service(2500, "monthly"), service(9000, "quarterly"), service(12000, "yearly"), service(5000, "monthly", "eur"), service(25000, "one-time"), service(9000, "monthly", "usd", "paused")]), [{ currency: "usd", amount: 6500 }, { currency: "eur", amount: 5000 }]);
});

test("Stripe's item-level period and trial end provide the expected renewal date", () => {
  const subscription = { status: "active", collection_method: "charge_automatically", items: { data: [{ current_period_end: 1800000000 }, { current_period_end: 1800100000 }] } };
  assert.equal(stripeSchedule(subscription).nextPaymentAt, new Date(1800000000 * 1000).toISOString());
  assert.equal(stripeSchedule({ ...subscription, status: "trialing", trial_end: 1799000000 }).nextPaymentAt, new Date(1799000000 * 1000).toISOString());
  assert.equal(stripeSchedule({ ...subscription, cancel_at: 1799900000 }).nextPaymentAt, null);
});

test("paused, canceled, invoice-paid and unknown schedules never invent a next payment", () => {
  const subscription = { status: "active", collection_method: "charge_automatically", items: { data: [{ current_period_end: 1800000000 }] } };
  for (const extra of [{ pause_collection: {} }, { status: "canceled" }, { status: "past_due" }, { cancel_at_period_end: true }, { collection_method: "send_invoice" }, { items: { data: [] } }]) assert.equal(stripeSchedule({ ...subscription, ...extra }).nextPaymentAt, null);
});
