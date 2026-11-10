import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("../", import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "website-products-onboarding-"));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.match(basename(root), /^website-products-onboarding-/);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, "scripts"));
  await cp(join(workspace, "scripts/new-site.mjs"), join(root, "scripts/new-site.mjs"));
  await mkdir(join(root, "templates"));
  await cp(join(workspace, "templates/website-starter"), join(root, "templates/website-starter"), { recursive: true });
  const run = args => execFileSync(process.execPath, [join(root, "scripts/new-site.mjs"), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { root, run };
}

test("onboarding uses projects/ and reserves ports from nested manifests without copying data", async t => {
  const { root, run } = await fixture(t);
  for (const [name, port] of [["breeze-web", 3000], ["extreme-bike-team", 3002]]) {
    await mkdir(join(root, "projects", name), { recursive: true });
    await writeFile(join(root, "projects", name, "site.config.json"), JSON.stringify({ localPort: port }));
  }
  const output = JSON.parse(run(["--id", "qa-client", "--name", 'A Quoted "Name"', "--dry-run"]));
  assert.equal(output.name, 'A Quoted "Name"');
  assert.equal(output.port, 3003);
  assert.equal(output.folder, join(root, "projects", "qa-client-web"));
  await assert.rejects(access(output.folder), { code: "ENOENT" });
  for (const args of [
    ["--id", "../breeze-web"], ["--id", "breeze"],
    ["--id", "qa-client", "--port", "3001"], ["--id", "qa-client", "--port", "3002"],
  ]) assert.throws(() => run([...args, "--dry-run"]));
});

test("onboarding creates a standalone project under projects/ and refuses overwrites", async t => {
  const { root, run } = await fixture(t);
  const output = run(["--id", "qa-client", "--name", "QA Client"]);
  const target = join(root, "projects", "qa-client-web");
  const manifest = JSON.parse(await readFile(join(target, "site.config.json"), "utf8"));
  const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
  assert.equal(manifest.projectPath, "projects/qa-client-web");
  assert.equal(manifest.localPort, 3002);
  assert.equal(pkg.name, "qa-client-web");
  assert.match(pkg.scripts.dev, /--port 3002/);
  assert.match(output, /npm --prefix projects\/qa-client-web run dev/);
  await assert.rejects(access(join(root, "qa-client-web")), { code: "ENOENT" });
  await writeFile(join(target, "owner-content.txt"), "Keep existing work");
  assert.throws(() => run(["--id", "qa-client"]));
  assert.equal(await readFile(join(target, "owner-content.txt"), "utf8"), "Keep existing work");
});
