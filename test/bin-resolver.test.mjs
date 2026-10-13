// Ported from the origin, freedom-dev tests/claude-bin.test.mjs (v6.29.0, abf68266). Only the import
// path changed. One test was left in the origin and is named where it stood.
//
// One resolver for every spawn of `claude` that happens outside a terminal.
//
// Under launchd the bare name is ENOENT (the native installer's ~/.local/bin is not on
// launchd's PATH), and on 2026-09-20 the hub brain's "start a session on it" reached spin-up
// with a bare `claude`, died, and the failure was read aloud on the operator's phone. The
// board's model call had its own copy of the candidate list; spin-up had none. This file is
// the one both now read, and these tests pin the order and the override.
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { claudeBin, CANDIDATES, launchdPathDirs, claudeInstalls, bestClaudeBin } from "../src/bin-resolver.mjs";

test("FREEDOM_CLAUDE_BIN wins over everything on disk", () => {
  assert.equal(claudeBin({ env: { FREEDOM_CLAUDE_BIN: "/x/claude" }, home: "/U", exists: () => true }), "/x/claude");
});

test("the first candidate on disk wins, in order: a pinned claude-current, then the native installer's symlink, then brew", () => {
  assert.deepEqual(CANDIDATES("/U"), ["/U/.freedom/bin/claude-current", "/U/.local/bin/claude", "/opt/homebrew/bin/claude", "/usr/local/bin/claude"]);
  assert.equal(claudeBin({ env: {}, home: "/U", exists: (p) => p === "/U/.local/bin/claude" }), "/U/.local/bin/claude");
  assert.equal(claudeBin({ env: {}, home: "/U", exists: (p) => p.endsWith("claude-current") || p === "/U/.local/bin/claude" }), "/U/.freedom/bin/claude-current");
});

test("nothing on disk falls back to the bare name, which is right in a terminal and wrong nowhere worse than before", () => {
  assert.equal(claudeBin({ env: {}, home: "/U", exists: () => false }), "claude");
});

test("no candidate is a claude-managed versioned path: ~/.local/share/claude/versions moves on every update", () => {
  for (const c of CANDIDATES("/U")) assert.doesNotMatch(c, /share\/claude\/versions/);
});

test("the launchd PATH additions are the two user-level bin dirs a candidate can live in", () => {
  assert.deepEqual(launchdPathDirs({ home: "/U" }), ["/U/.freedom/bin", "/U/.local/bin"]);
});

// NOT PORTED: the origin test "spin-up and the board both spawn through this resolver" reads two
// origin call sites (spin-up.mjs and freedom-board.mjs). It pins the origin's callers, not the
// resolver, so it stays in the origin.

// A LEFTOVER COPY IS NOT A FALLBACK, IT IS THE ONE THAT RUNS (freedom#242).
//
// On a Mac with a current nvm install (2.1.280) and an npm global left over from March at
// /usr/local/bin/claude (2.1.88), the resolver returned the March one: the list has no nvm
// location and never compares versions, so the first path that EXISTS wins whatever it holds.
// The session-start check reported "Claude Code 2.1.88 is installed" every session and the Next
// Step homework job ran 2.1.88. `claude update` could not clear it, because it updates the other
// copy. Nothing on screen said which file was being read, so the operator had no way to see it.
const NVM = "/U/.nvm/versions/node/v25.1.0/bin/claude";
const nvmFs = { exists: (p) => p === NVM || p === "/usr/local/bin/claude", list: () => ["v22.1.0", "v25.1.0"] };

test("nvm is a candidate location, so a current nvm install is not invisible", () => {
  const c = CANDIDATES("/U", nvmFs);
  assert.ok(c.includes(NVM), "the nvm layout is where a node-managed install lives");
  assert.ok(c.indexOf(NVM) < c.indexOf("/usr/local/bin/claude"), "and a newer node outranks an old npm global");
});

test("nvm node versions are enumerated NEWEST first, so an abandoned node is not preferred", () => {
  const c = CANDIDATES("/U", { exists: () => true, list: () => ["v18.0.0", "v25.1.0", "v22.1.0"] });
  const nvm = c.filter((p) => p.includes(".nvm"));
  assert.deepEqual(nvm.map((p) => p.split("/node/")[1].split("/")[0]), ["v25.1.0", "v22.1.0", "v18.0.0"]);
});

test("with more than one install, the HIGHEST version wins rather than the first path on disk", () => {
  const versions = { [NVM]: "2.1.280", "/usr/local/bin/claude": "2.1.88" };
  const exists = (p) => p in versions;
  const best = bestClaudeBin({ env: {}, home: "/U", exists, list: nvmFs.list, version: (p) => versions[p] ?? null });
  assert.equal(best.path, "/U/.nvm/versions/node/v25.1.0/bin/claude", "the March leftover is not what runs");
  assert.equal(best.version, "2.1.280");
  assert.equal(claudeBin({ env: {}, home: "/U", exists, list: nvmFs.list, version: (p) => versions[p] ?? null }), NVM);
});

test("claudeInstalls reports EVERY copy on disk with its version, so a row can name the path it read", () => {
  const versions = { [NVM]: "2.1.280", "/usr/local/bin/claude": "2.1.88" };
  const all = claudeInstalls({ home: "/U", exists: (p) => p in versions, list: nvmFs.list, version: (p) => versions[p] ?? null });
  assert.equal(all.length, 2, "both copies are visible, which is the fact the operator could not see");
  assert.deepEqual(all.map((i) => i.version), ["2.1.280", "2.1.88"], "newest first");
});

test("one install needs no version probe at all, so the common machine pays nothing", () => {
  let probes = 0;
  const path = claudeBin({ env: {}, home: "/U", exists: (p) => p === "/U/.local/bin/claude",
                           version: () => { probes++; return "2.1.280"; } });
  assert.equal(path, "/U/.local/bin/claude");
  assert.equal(probes, 0, "a single candidate is the answer without spawning anything");
});

test("FREEDOM_CLAUDE_BIN still wins over a newer copy, because an override is a decision", () => {
  assert.equal(claudeBin({ env: { FREEDOM_CLAUDE_BIN: "/x/claude" }, home: "/U", exists: () => true,
                           version: () => "9.9.9" }), "/x/claude");
});

// THE CASE WHERE ORDER AND VERSION DISAGREE, which is the only one that proves the comparison.
//
// The test above passes on candidate ORDER alone: nvm is listed before /usr/local, so the newest
// copy wins there even with the version sort removed. Caught by mutation (removing the sort left
// the suite green), and it is the shape this file's own history warns about: an assertion that
// passes against the very thing it was written to catch. Here the NEWEST copy sits at the LOWEST
// priority path, so only a real comparison can pick it.
test("the newest copy wins even when it sits at the lowest-priority path", () => {
  const versions = { [NVM]: "2.1.88", "/usr/local/bin/claude": "2.1.280" };
  const best = bestClaudeBin({ env: {}, home: "/U", exists: (p) => p in versions, list: nvmFs.list,
                               version: (p) => versions[p] ?? null });
  assert.equal(best.path, "/usr/local/bin/claude", "priority order loses to the actual version");
  assert.equal(best.version, "2.1.280");
});

test("a copy whose version cannot be read sorts oldest rather than winning by position", () => {
  const versions = { [NVM]: null, "/usr/local/bin/claude": "2.1.280" };
  const best = bestClaudeBin({ env: {}, home: "/U", exists: (p) => p in versions, list: nvmFs.list,
                               version: (p) => versions[p] ?? null });
  assert.equal(best.path, "/usr/local/bin/claude", "an unreadable copy is never preferred to a known one");
});

// A PIN IS A DECISION, AND A NEWER COPY DOES NOT OVERRULE IT.
//
// ~/.freedom/bin/claude-current is where an operator pins a binary: freedom-timer.mjs calls it
// `pinnedBin`, and the meeting timer, the overnight pass and spin-up all reach for it first.
// Ranking purely by version would have silently undone that choice the moment anything newer
// appeared. #242 is about position beating VERSION among ordinary installs; it is not a licence
// to overrule somebody's pin. The row is where a stale pin gets raised, because that is a
// decision for the operator rather than for the resolver.
test("a pinned claude-current wins even when a newer copy exists, and says it is a pin", () => {
  const PIN = "/U/.freedom/bin/claude-current";
  const versions = { [PIN]: "2.1.263", "/U/.local/bin/claude": "2.1.281" };
  const best = bestClaudeBin({ env: {}, home: "/U", exists: (p) => p in versions, list: () => [],
                               version: (p) => versions[p] ?? null });
  assert.equal(best.path, PIN, "the pin is honoured");
  assert.equal(best.pinned, true, "and the caller can tell it was a pin rather than a ranking");
  assert.equal(best.installs.find((i) => i.path === "/U/.local/bin/claude").version, "2.1.281",
    "while the newer copy stays visible, so a row can raise it");
});

test("cmpV, claudeVersion and pinnedPath keep the origin's names and behaviour", async () => {
  const m = await import("../src/bin-resolver.mjs");
  assert.ok(m.cmpV("2.1.280", "2.1.88") > 0);
  assert.equal(m.cmpV("1.0", "1.0.0"), 0);
  assert.equal(m.claudeVersion("/x", { run: () => "2.1.296 (Claude Code)" }), "2.1.296");
  assert.equal(m.claudeVersion("/x", { run: () => { throw new Error("ENOENT"); } }), null);
  assert.equal(m.pinnedPath("/U"), "/U/.freedom/bin/claude-current");
});
