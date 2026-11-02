import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { filterMarketing, validateMarketingRecord, marketingCsv, marketingEmails, safeMarketingUrl } from "../src/shared/marketing.mjs";
import { readMarketing, mutateMarketing, marketingPath } from "../src/admin/server/marketing-store.mjs";

const contact = (extra = {}) => validateMarketingRecord({ name: "Temporary test business", priority: "high", stage: "to-review", payment_status: "unknown", ...extra });
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "marketing-test-")), path = join(dir, "marketing.json");
  t.after(() => rm(dir, { recursive: true, force: true }));
  const row = { ...contact(), id: "source-1", version: 1, history: [{ name: "Original name", source_pages: [4], notes: "Source evidence" }], contests: [] };
  await writeFile(path, JSON.stringify({ schema_version: 1, sources: [{ file: "private-source.pdf" }], contest_history: [{ name: "Award" }], records: [row], activity: [] }));
  return { dir, path, row };
}
test("marketing edits persist independently, retain evidence, and reject stale edits/deletions", async t => {
  const { path, row } = await fixture(t);
  const result = await mutateMarketing({ action: "save", id: row.id, version: row.version, record: contact({ name: "Updated name", payment_status: "quoted", payment_notes: "$500 quote, receipt not established" }) }, "test-owner", path);
  assert.equal(result.record.version, 2);
  const saved = await readMarketing(path);
  assert.equal(saved.records[0].name, "Updated name");
  assert.deepEqual(saved.records[0].history, row.history);
  assert.equal(saved.contest_history.length, 1);
  assert.equal(saved.activity[0].actor, "test-owner");
  assert.equal(saved.activity[0].before.name, row.name);
  assert.equal(JSON.parse(await readFile(`${path}.backup.json`, "utf8")).records[0].version, 1);
  for (const action of ["save", "delete"]) await assert.rejects(mutateMarketing({ action, id: row.id, version: 1, record: contact() }, "stale-window", path), error => error.status === 409);
  assert.equal((await readMarketing(path)).records[0].version, 2);
});
test("marketing create and delete preserve unrelated records, original archive, and recovery history", async t => {
  const { path, row } = await fixture(t);
  const { record } = await mutateMarketing({ action: "save", record: contact({ name: "New test record" }) }, "test-owner", path);
  assert.notEqual(record.id, row.id);
  assert.equal((await readMarketing(path)).records.length, 2);
  await mutateMarketing({ action: "delete", id: record.id, version: 1 }, "test-owner", path);
  const data = await readMarketing(path);
  assert.deepEqual(data.records, [row]);
  assert.equal(data.activity.at(-1).before.name, "New test record");
  assert.equal(data.contest_history.length, 1);
  await assert.rejects(mutateMarketing({ action: "delete", id: record.id, version: 1 }, "test-owner", path), error => error.status === 404);
  await mutateMarketing({ action: "delete", id: row.id, version: 1 }, "test-owner", path);
  assert.equal((await readMarketing(path)).records.length, 0, "An empty list is never re-seeded");
});
test("file locking prevents parallel writers and missing/corrupt files are not replaced", async t => {
  const { dir, path, row } = await fixture(t);
  const results = await Promise.allSettled([1, 2].map(() => mutateMarketing({ action: "save", id: row.id, version: 1, record: contact() }, "test-owner", path)));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.find(result => result.status === "rejected").reason.status, 409);
  const missing = join(dir, "missing.json");
  await assert.rejects(mutateMarketing({ action: "save", record: contact() }, "test-owner", missing), error => error.status === 503);
  await writeFile(path, "{broken");
  await assert.rejects(mutateMarketing({ action: "save", record: contact() }, "test-owner", path), error => error.status === 503);
  assert.equal(await readFile(path, "utf8"), "{broken");
  assert.throws(() => marketingPath({ NODE_ENV: "production" }), error => error.status === 503);
  assert.throws(() => marketingPath({ NODE_ENV: "production", MARKETING_DATA_PATH: ".data/file.json" }), error => error.status === 503);
  assert.equal(marketingPath({ NODE_ENV: "production", MARKETING_DATA_PATH: path }), path);
});
test("combined marketing filters use calendar dates, preserve payment distinctions, and search source evidence", () => {
  const rows = [
    { ...contact({ name: "Older paid", priority: "medium", payment_status: "paid", last_contact: "2020-01-01", year: "2020" }), id: "1", history: [{ notes: "Legacy needle" }] },
    { ...contact({ name: "Recent quote", email: "Contact via platform", payment_status: "quoted", last_contact: "2026-10-15", year: "2026" }), id: "2" },
    { ...contact({ name: "Deposit", email: "Jane <jane@example.test>; jane@example.test", payment_status: "deposit", last_contact: "2026-09-01", follow_up: "2026-10-31", year: "2026" }), id: "3" },
    { ...contact({ name: "Suppressed", stage: "do-not-contact", follow_up: "2020-01-01" }), id: "4" },
  ];
  const ids = filters => filterMarketing(rows, filters, "2026-10-31").map(row => row.id);
  assert.deepEqual(ids({ priority: "high", contact: "recent", payment: "quoted", email: "missing", year: "2026" }), ["2"]);
  assert.deepEqual(ids({ query: "older needle", payment: "paid", from: "2019-12-31", to: "2020-01-02" }), ["1"]);
  assert.deepEqual(ids({ contact: "365" }), ["1"]);
  assert.deepEqual(ids({ followUp: "due" }), ["3"]);
  assert.deepEqual(ids({ email: "available" }), ["3"]);
  assert.deepEqual(ids({ sort: "oldest" }), ["1", "3", "2", "4"]);
  assert.deepEqual(ids({ payment: "prize" }), []);
  assert.equal(rows[0].id, "1", "Filtering does not reorder the source array");
  assert.deepEqual(marketingEmails(rows[2].email), ["jane@example.test"]);
});
test("marketing validation blocks unsafe links, invalid dates and spreadsheet formulas", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,x", "https://user:pass@example.test"]) {
    assert.equal(safeMarketingUrl(url), "");
    assert.throws(() => contact({ website: url }));
  }
  for (const last_contact of ["2026-02-30", "2026-13-01", "not-a-date"]) assert.throws(() => contact({ last_contact }));
  assert.throws(() => contact({ payment_status: "invented" }));
  assert.throws(() => contact({ stage: "invented" }));
  assert.throws(() => contact({ year: "26" }));
  assert.throws(() => contact({ name: "  " }));
  assert.match(marketingCsv([contact({ name: " =HYPERLINK(x)", notes: 'Two lines\n"quoted"' })]), /"'=HYPERLINK\(x\)"/);
  assert.match(marketingCsv([contact({ notes: 'Two lines\n"quoted"' })]), /Two lines\n""quoted""/);
});
