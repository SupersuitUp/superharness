import { test } from "node:test";
import assert from "node:assert/strict";
import claudeCode from "../src/adapters/claude-code.mjs";
import codex from "../src/adapters/codex.mjs";
import { defineHarness } from "../src/define.mjs";
import { CLAUSES } from "../src/contract.mjs";
import { checkStatic, checkLive, summarize } from "../src/conformance.mjs";

const minimal = (over = {}) => defineHarness({ id: "x", label: "X", configDir: (h) => h, skillsDir: (h) => h,
  transcriptsRoot: (h) => h, bin: () => "x", deliverIdentity: { via: "hook-context" },
  moments: { sessionStart: "S" }, ...over });

test("both shipped adapters pass the static check with every core clause green", () => {
  for (const f of [claudeCode, codex]) {
    const s = summarize(checkStatic(f({})));
    assert.equal(s.pass, true, JSON.stringify(s.failed));
    assert.equal(s.core.ok, s.core.total);
  }
});
test("a harness with no skills folder fails, and the failure names the clause", () => {
  const p = defineHarness({ id: "x", label: "X", configDir: (h) => h, transcriptsRoot: (h) => h,
    bin: () => "x", deliverIdentity: { via: "hook-context" }, moments: { sessionStart: "S" } });
  const s = summarize(checkStatic(p));
  assert.equal(s.pass, false);
  assert.deepEqual(s.failed, ["places.skillsDir"]);
});
test("a yes with no evidence fails even though abilities are optional", () => {
  const p = { ...claudeCode({}) };
  p.abilities = { ...p.abilities, phone: { answer: "yes" } };
  assert.ok(summarize(checkStatic(p)).failed.includes("abilities.phone"));
});
test("an optional clause that is simply absent passes as not provided", () => {
  const p = defineHarness({ id: "x", label: "X", configDir: (h) => h, skillsDir: (h) => h,
    transcriptsRoot: (h) => h, bin: () => "x", deliverIdentity: { via: "hook-context" },
    moments: { sessionStart: "S" } });
  assert.equal(summarize(checkStatic(p)).pass, true);
});
test("live: an installed harness reports its version; a missing one is skipped, never failed", async () => {
  const ok = await checkLive(claudeCode({}), { home: "/h", run: () => "9.9.9 (Claude Code)", exists: () => true });
  assert.equal(ok.find((r) => r.id === "live.bin").ok, true);
  const none = await checkLive(claudeCode({}), { home: "/h", run: () => { throw new Error("ENOENT"); }, exists: () => false });
  assert.equal(none.find((r) => r.id === "live.bin").ok, null);
});

// ---------------------------------------------------------------------------
// The rules, one at a time
// ---------------------------------------------------------------------------

test("there is one result per clause, in the contract's order, plus the purity rule", () => {
  const r = checkStatic(minimal());
  assert.deepEqual(r.map((x) => x.id), [...CLAUSES.map((c) => c.id), "purity"]);
  for (const x of r) {
    assert.equal(typeof x.ok, "boolean", x.id);
    assert.ok(x.why.length > 0, x.id);
    assert.ok(["core", "optional"].includes(x.level), x.id);
  }
});
test("a core place must return a non-empty string: null, empty and a throw all fail", () => {
  for (const configDir of [() => null, () => "", () => { throw new Error("boom"); }, "/not/a/function"]) {
    const s = summarize(checkStatic(minimal({ configDir })));
    assert.ok(s.failed.includes("places.configDir"), String(configDir));
    assert.equal(s.pass, false);
  }
});
test("an optional place may return null, and one that is present and malformed fails", () => {
  assert.equal(summarize(checkStatic(minimal({ sessionsDir: () => null }))).pass, true);
  assert.deepEqual(summarize(checkStatic(minimal({ sessionsDir: () => 42 }))).failed, ["places.sessionsDir"]);
  assert.deepEqual(summarize(checkStatic(minimal({ settingsFile: "settings.json" }))).failed, ["places.settingsFile"]);
  const s = summarize(checkStatic(minimal({ sessionsDir: () => 42 })));
  assert.equal(s.pass, false, "a malformed optional clause fails the check even with the core green");
  assert.equal(s.core.ok, s.core.total);
});
test("transcriptPath is called with a home, a working directory and a session id", () => {
  let got;
  checkStatic(minimal({ transcriptPath: (...a) => { got = a; return null; } }), { home: "/home/q" });
  assert.deepEqual(got, ["/home/q", "/w", "sid"]);
});
test("a core moment must be a string; an optional moment may be null but not a number", () => {
  assert.ok(summarize(checkStatic(minimal({ moments: {} }))).failed.includes("moments.sessionStart"));
  assert.deepEqual(summarize(checkStatic(minimal({ moments: { sessionStart: "S", stop: 7 } }))).failed, ["moments.stop"]);
});
test("identity delivery is core: it needs a known route, and a file route needs a file getter", () => {
  assert.ok(summarize(checkStatic(minimal({ deliverIdentity: undefined }))).failed.includes("actions.deliverIdentity"));
  assert.ok(summarize(checkStatic(minimal({ deliverIdentity: { via: "pigeon" } }))).failed.includes("actions.deliverIdentity"));
  assert.ok(summarize(checkStatic(minimal({ deliverIdentity: { via: "file" } }))).failed.includes("actions.deliverIdentity"));
  assert.equal(summarize(checkStatic(minimal({ deliverIdentity: { via: "file", file: (h) => h + "/A.md" } }))).pass, true);
});
test("startBackground may be null, and when present must build { cmd, args }", () => {
  assert.equal(summarize(checkStatic(minimal({ startBackground: null }))).pass, true);
  assert.equal(summarize(checkStatic(minimal({ startBackground: () => ({ cmd: "x", args: ["a"] }) }))).pass, true);
  assert.deepEqual(summarize(checkStatic(minimal({ startBackground: () => "x --bg" }))).failed, ["actions.startBackground"]);
  assert.deepEqual(summarize(checkStatic(minimal({ runPrompt: "x -p" }))).failed, ["actions.runPrompt"]);
});
test("an ability answer must be yes, no or unmeasured, and a yes needs a real date", () => {
  const withPhone = (phone) => summarize(checkStatic(minimal({ abilities: { phone } }))).failed;
  assert.deepEqual(withPhone({ answer: "maybe" }), ["abilities.phone"]);
  assert.deepEqual(withPhone({ answer: "yes", measured: "last week", version: "1", evidence: "e" }), ["abilities.phone"]);
  assert.deepEqual(withPhone({ answer: "yes", measured: "2026-10-13", version: "1" }), ["abilities.phone"]);
  assert.deepEqual(withPhone({ answer: "yes", measured: "2026-10-13", evidence: "e" }), ["abilities.phone"]);
  assert.deepEqual(withPhone({ answer: "yes", measured: "2026-10-13", version: "1", evidence: "e" }), []);
  assert.deepEqual(withPhone({ answer: "no" }), []);
});
test("purity: a place getter that reads process.env fails, and the real environment is put back", () => {
  const before = process.env;
  const p = minimal({ skillsDir: (h) => (process.env.SOME_DIR || h) + "/skills" });
  const r = checkStatic(p);
  assert.equal(r.find((x) => x.id === "purity").ok, false);
  assert.match(r.find((x) => x.id === "purity").why, /skillsDir/);
  assert.ok(summarize(r).failed.includes("purity"));
  assert.equal(process.env, before);
});
test("summarize counts core and optional apart and lists every failure", () => {
  const s = summarize(checkStatic(claudeCode({})));
  assert.equal(s.core.total, 7, "the six core clauses and the purity rule");
  assert.equal(s.optional.total, CLAUSES.length - 6);
  assert.deepEqual(s.failed, []);
});

test("live: the version string the program printed is recorded", async () => {
  const r = await checkLive(codex({}), { home: "/h", run: () => "codex-cli 0.162.1\n", exists: () => true });
  const bin = r.find((x) => x.id === "live.bin");
  assert.equal(bin.version, "codex-cli 0.162.1");
  assert.equal(r.find((x) => x.id === "live.configDir").ok, true);
});
test("live: the program is asked for its version and nothing else", async () => {
  const calls = [];
  await checkLive(codex({}), { home: "/h", run: (cmd, args) => { calls.push([cmd, args]); return "1.2.3"; }, exists: () => true });
  assert.deepEqual(calls, [["codex", ["--version"]]]);
});
test("live: a program that runs but exits badly is a failure, and a missing config folder is one too", async () => {
  const bad = await checkLive(codex({}), { home: "/h", run: () => { const e = new Error("exit 3"); e.status = 3; throw e; }, exists: () => true });
  assert.equal(bad.find((x) => x.id === "live.bin").ok, false);
  const noDir = await checkLive(codex({}), { home: "/h", run: () => "1.2.3", exists: () => false });
  assert.equal(noDir.find((x) => x.id === "live.configDir").ok, false);
});
test("live: a missing harness skips every machine row with the same reason", async () => {
  const r = await checkLive(codex({}), { home: "/h", run: () => { const e = new Error("spawn codex ENOENT"); e.code = "ENOENT"; throw e; }, exists: () => false });
  for (const id of ["live.bin", "live.configDir"]) {
    assert.equal(r.find((x) => x.id === id).ok, null);
    assert.equal(r.find((x) => x.id === id).why, "harness not installed");
  }
});
test("live: the session-level probes are declared and never faked", async () => {
  const r = await checkLive(claudeCode({}), { home: "/h", run: () => "9.9.9", exists: () => true });
  const probes = r.filter((x) => x.id.startsWith("live.session."));
  assert.deepEqual(probes.map((x) => x.id), ["live.session.hookFires", "live.session.identityArrives", "live.session.recordReadable"]);
  for (const p of probes) {
    assert.equal(p.ok, null);
    assert.equal(p.why, "needs an interactive probe; see CONTRACT.md, Live check");
  }
  assert.equal(summarize(r).pass, true, "a row nobody could measure is not a failure");
});
