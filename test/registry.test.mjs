// The first five tests are ported from the origin, freedom-dev tests/harness.test.mjs (v6.29.0,
// abf68266), lines 23-53. Only the import path changed. No assertion was weakened.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_HARNESS, HARNESSES, BUILTIN, PROFILES, harnessId, harness, isSwapped, installed,
  register, loadAdapter,
} from "../src/registry.mjs";

const HOME = "/Users/someone";

// ---------------------------------------------------------------------------
// The flag
// ---------------------------------------------------------------------------

test("the default harness is claude-code, so an operator who never sets it is unaffected", () => {
  assert.equal(DEFAULT_HARNESS, "claude-code");
  assert.equal(harnessId({ env: {}, config: {} }), "claude-code");
  assert.equal(harness({ env: {}, home: HOME }).id, "claude-code");
});

test("the flag is read from the machine config, which is where the machine already knows itself", () => {
  assert.equal(harnessId({ env: {}, config: { harness: "codex" } }), "codex");
});

test("FREEDOM_HARNESS wins over the config, so a test or one session can switch without touching the machine", () => {
  assert.equal(harnessId({ env: { FREEDOM_HARNESS: "codex" }, config: { harness: "claude-code" } }), "codex");
});

test("an unknown harness falls back to the default rather than throwing", () => {
  // A typo in a config file must not brick every hook on the machine. The hooks fail open by
  // design (hooks/_node.sh), and a resolver that throws would defeat that one level up.
  assert.equal(harnessId({ env: {}, config: { harness: "emacs" } }), "claude-code");
  assert.equal(harnessId({ env: { FREEDOM_HARNESS: "nonsense" }, config: {} }), "claude-code");
});

test("every declared harness has a profile, and every profile declares the same keys", () => {
  for (const id of HARNESSES) assert.ok(PROFILES[id], `no profile for ${id}`);
  const keys = (o) => Object.keys(o).sort().join(",");
  assert.equal(keys(PROFILES["claude-code"]), keys(PROFILES.codex),
    "the two profiles answer different questions, so a call site would work on one and not the other");
});

// ---------------------------------------------------------------------------
// New in this package
// ---------------------------------------------------------------------------

test("a third harness is one file: loadAdapter takes a path, and register makes it resolvable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hh-"));
  const file = join(dir, "toy.mjs");
  writeFileSync(file, `export default (env) => ({ id: "toy", label: "Toy",
    configDir: (h) => h + "/.toy", skillsDir: (h) => h + "/.toy/skills",
    transcriptsRoot: (h) => h + "/.toy/log", bin: () => "toy",
    deliverIdentity: { via: "hook-context" }, moments: { sessionStart: "Start" } });`);
  const factory = await loadAdapter(file);
  register("toy", factory);
  assert.equal(harness({ env: { FREEDOM_HARNESS: "toy" }, home: "/h", config: {} }).id, "toy");
  assert.equal(harness({ env: { FREEDOM_HARNESS: "toy" }, home: "/h", config: {} }).can.phone, false);
  assert.deepEqual(harness({ env: { FREEDOM_HARNESS: "toy" }, home: "/h", config: {} }).events, ["Start"]);
});
test("the env var name is configurable, so a product other than Freedom can use the resolver", () => {
  assert.equal(harnessId({ env: { MY_HARNESS: "codex" }, config: {}, envVar: "MY_HARNESS" }), "codex");
  assert.equal(harnessId({ env: { FREEDOM_HARNESS: "codex" }, config: {}, envVar: "MY_HARNESS" }), "claude-code");
});
test("the config file is configurable too, and the default is the one Freedom reads", () => {
  const home = mkdtempSync(join(tmpdir(), "hh-home-"));
  writeFileSync(join(home, "mine.json"), JSON.stringify({ harness: "codex" }));
  assert.equal(harnessId({ env: {}, home, configFile: (h) => join(h, "mine.json") }), "codex");
  assert.equal(harnessId({ env: {}, home }), "claude-code", "no ~/.freedom/config.json in this home");
});
test("loadAdapter: a builtin id returns its factory, and a file whose default export is a plain object is wrapped", async () => {
  assert.equal((await loadAdapter("codex"))({}).id, "codex");
  const dir = mkdtempSync(join(tmpdir(), "hh-"));
  const file = join(dir, "obj.mjs");
  writeFileSync(file, `export default { id: "obj", label: "Obj", configDir: (h) => h, skillsDir: (h) => h,
    transcriptsRoot: (h) => h, bin: () => "obj", deliverIdentity: { via: "hook-context" },
    moments: { sessionStart: "S" } };`);
  const p = (await loadAdapter(file))({});
  assert.equal(p.id, "obj");
  assert.equal(p.can.phone, false);
  assert.equal(p.abilities.phone.answer, "unmeasured");
});
test("loadAdapter refuses a file with no usable default export, by name", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hh-"));
  const file = join(dir, "bad.mjs");
  writeFileSync(file, "export const nothing = 1;");
  await assert.rejects(loadAdapter(file), /default export/);
});
test("the builtins are exactly the two shipped harnesses, and a registered one never joins HARNESSES", () => {
  assert.deepEqual(Object.keys(BUILTIN), ["claude-code", "codex"]);
  assert.deepEqual(HARNESSES, ["claude-code", "codex"]);
});
test("isSwapped and installed keep the origin's behaviour", () => {
  assert.equal(isSwapped({ env: {}, config: {} }), false);
  assert.equal(isSwapped({ env: { FREEDOM_HARNESS: "codex" }, config: {} }), true);
  assert.equal(installed(PROFILES.codex, "/h", (p) => p === "/h/.codex"), true);
  assert.equal(installed(PROFILES.codex, "/h", () => false), false);
});
test("the environment passed to harness() reaches the adapter", () => {
  assert.equal(harness({ env: { CLAUDE_CONFIG_DIR: "/cfg" }, home: HOME, config: {} }).configDir(HOME), "/cfg");
});
