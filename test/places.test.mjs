// The places entry point (@supersuit/superharness/places): where each shipped harness keeps
// things, importable by a host that must not load anything that runs programs.
//
// Three promises are tested here. The full adapters answer every 0.2.0 place exactly as 0.2.0 did,
// in every environment the matrix covers. The places module and the full adapters are one copy, so
// they agree on every key. And nothing the places module imports can start a program.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import claudeCode from "../src/adapters/claude-code.mjs";
import codex from "../src/adapters/codex.mjs";
import { CLAUSES } from "../src/contract.mjs";
import { checkStatic, summarize } from "../src/conformance.mjs";
import { PROFILES } from "../src/registry.mjs";
import { ENVS, HOMES, record } from "./places-matrix.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOME = "/Users/someone";
const places = await import("../src/places.mjs");
const { PLACES, claudeCodePlaces, codexPlaces } = places;

// ---------------------------------------------------------------------------
// Nothing changed for an existing importer
// ---------------------------------------------------------------------------

test("the full adapters answer every 0.2.0 place exactly as 0.2.0 did, in every environment", () => {
  const fixture = JSON.parse(readFileSync(join(ROOT, "test", "places-0.2.0.json"), "utf8"));
  assert.ok(fixture.rows.length >= 20);
  assert.deepEqual(record({ "claude-code": claudeCode, codex }), fixture.rows);
});

const NEW_KEYS = ["projectDir", "userInstructionsFile", "isInsidePluginFolder", "credentialsFile", "bridgeSpawnDir", "bridgePointerFile"];
const OLD_KEYS = ["configDir", "settingsFile", "pluginCacheDir", "marketplacesDir", "skillsDir", "sessionsDir", "transcriptsRoot", "transcriptPath", "worktreesDir"];

/** The arguments each place is called with when two answers are compared. */
const argsFor = (key, home) => ({
  transcriptPath: [[home, "/a/b", "s1"], [home, "", "s1"]],
  bridgePointerFile: [[home, "/a/b"], [home, ""]],
  worktreesDir: [["/repo"], ["rel"]],
  projectDir: [["/repo"], ["rel"]],
  isInsidePluginFolder: [[`${home}/.claude/plugins/cache/x`, home], [`${home}/.codex/plugins/marketplaces/m`, home], ["/w/notes", home]],
}[key] || [[home]]);

test("the places module and the full adapters are one copy: every place agrees in every environment", () => {
  for (const [id, adapter] of [["claude-code", claudeCode], ["codex", codex]]) {
    for (const env of ENVS) {
      const a = adapter(env), p = PLACES[id](env);
      assert.deepEqual(Object.keys(p).sort(), [...OLD_KEYS, ...NEW_KEYS].sort(), id);
      for (const key of Object.keys(p))
        for (const home of HOMES)
          for (const args of argsFor(key, home))
            assert.equal(a[key](...args), p[key](...args), `${id} ${key}(${JSON.stringify(args)}) with ${JSON.stringify(env)}`);
    }
  }
});

test("each place has one body: the adapters do not carry a second copy of any getter", () => {
  for (const [id, adapter] of [["claude-code", claudeCode], ["codex", codex]]) {
    const src = readFileSync(join(ROOT, "src", "adapters", `${id}.mjs`), "utf8");
    for (const key of [...OLD_KEYS, ...NEW_KEYS])
      assert.ok(!new RegExp(`^\\s*${key}\\s*:`, "m").test(src), `${id}.mjs defines ${key} itself`);
    assert.match(src, /from "\.\.\/places\.mjs"/, `${id}.mjs does not import its places`);
    assert.equal(typeof adapter({})[NEW_KEYS[0]], "function");
  }
});

test("PLACES names exactly the shipped harnesses, and each entry is the named export", () => {
  assert.deepEqual(Object.keys(PLACES).sort(), Object.keys(PROFILES).sort());
  assert.equal(PLACES["claude-code"], claudeCodePlaces);
  assert.equal(PLACES.codex, codexPlaces);
  assert.ok(Object.isFrozen(PLACES));
});

test("the package exports ./places, and a self-reference resolves to the same module", async () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.exports["./places"], "./src/places.mjs");
  const viaName = await import("@supersuit/superharness/places");
  assert.equal(viaName.PLACES, PLACES);
});

// ---------------------------------------------------------------------------
// The import graph: nothing in it can start a program
// ---------------------------------------------------------------------------

/** Every module specifier a file imports or re-exports statically, or loads with a literal import(). */
const specifiers = (text) => [
  ...text.matchAll(/^\s*(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']/gm),
  ...text.matchAll(/^\s*import\s*["']([^"']+)["']/gm),
  ...text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
].map((m) => m[1]);

/** Every file reachable from `entry` through relative specifiers, and every bare specifier seen. */
function graph(entry) {
  const files = [], bare = new Set(), todo = [entry];
  while (todo.length) {
    const f = todo.pop();
    if (files.includes(f)) continue;
    files.push(f);
    for (const s of specifiers(readFileSync(f, "utf8"))) {
      if (s.startsWith(".")) todo.push(resolve(dirname(f), s));
      else bare.add(s);
    }
  }
  return { files: files.map((f) => f.slice(ROOT.length + 1)), bare: [...bare] };
}

const RUNS_A_PROGRAM = /\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\s*\(/;

test("the places entry point's whole import graph mentions no child_process and calls no spawn or exec", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const { files, bare } = graph(join(ROOT, pkg.exports["./places"]));
  assert.ok(files.length >= 1);
  for (const f of files) {
    const text = readFileSync(join(ROOT, f), "utf8");
    assert.ok(!text.includes("child_process"), `${f} mentions child_process`);
    assert.ok(!RUNS_A_PROGRAM.test(text), `${f} calls something that starts a program`);
  }
  for (const s of bare) assert.ok(!/child_process/.test(s), `the graph imports ${s}`);
  assert.deepEqual(bare.filter((s) => !s.startsWith("node:")), [], "the places graph imports a package");
});

test("the graph walker sees what it is meant to see: the full entry point does reach child_process", () => {
  // Without this, a walker that found nothing would pass the test above for the wrong reason.
  const { files, bare } = graph(join(ROOT, "src", "index.mjs"));
  assert.ok(files.includes("src/places.mjs"));
  assert.ok(files.includes("src/bin-resolver.mjs"));
  assert.ok(bare.includes("node:child_process"));
  assert.deepEqual(specifiers('import a from "./x.mjs";\nexport { b } from "./y.mjs";\nimport "./z.mjs";\nconst c = await import("./w.mjs");'),
    ["./x.mjs", "./y.mjs", "./z.mjs", "./w.mjs"]);
});

// ---------------------------------------------------------------------------
// The new places, pinned to the exact string, against the Freedom call site they replace
// ---------------------------------------------------------------------------

test("projectDir: .claude for Claude Code, .codex for Codex, as a function of the project folder", () => {
  assert.equal(claudeCode({}).projectDir("/repo"), "/repo/.claude");
  assert.equal(codex({}).projectDir("/repo"), "/repo/.codex");
  // The environment never moves a project's own folder.
  assert.equal(claudeCode({ CLAUDE_CONFIG_DIR: "/cfg" }).projectDir("/repo"), "/repo/.claude");
  assert.equal(codex({ CODEX_HOME: "/cx" }).projectDir("/repo"), "/repo/.codex");
});

test("userInstructionsFile: <configDir>/CLAUDE.md for Claude Code, <CODEX_HOME>/AGENTS.md for Codex", () => {
  assert.equal(claudeCode({}).userInstructionsFile(HOME), "/Users/someone/.claude/CLAUDE.md");
  assert.equal(claudeCode({ CLAUDE_CONFIG_DIR: "/cfg" }).userInstructionsFile(HOME), "/cfg/CLAUDE.md");
  // freedom-codex-agents.mjs:24 and freedom-claude-memory.mjs:44 both compute this.
  assert.equal(codex({}).userInstructionsFile(HOME), "/Users/someone/.codex/AGENTS.md");
  assert.equal(codex({ CODEX_HOME: "/x/.codex" }).userInstructionsFile(HOME), "/x/.codex/AGENTS.md");
});

test("Codex's identity file is its userInstructionsFile, the same function and not a second copy", () => {
  for (const env of ENVS) {
    const p = codex(env);
    assert.equal(p.deliverIdentity.file, p.userInstructionsFile);
  }
});

test("credentialsFile: <configDir>/.credentials.json on Claude Code (freedom-cloudsession.mjs:110), null on Codex", () => {
  assert.equal(claudeCode({}).credentialsFile(HOME), "/Users/someone/.claude/.credentials.json");
  assert.equal(claudeCode({ CLAUDE_CONFIG_DIR: "/cfg" }).credentialsFile(HOME), "/cfg/.credentials.json");
  assert.equal(codex({}).credentialsFile(HOME), null);
});

test("bridgeSpawnDir: <configDir>/bridge-spawn on Claude Code (freedom-remotecontrol.mjs:702), null on Codex", () => {
  assert.equal(claudeCode({}).bridgeSpawnDir(HOME), "/Users/someone/.claude/bridge-spawn");
  assert.equal(claudeCode({ CLAUDE_CONFIG_DIR: "/cfg" }).bridgeSpawnDir(HOME), "/cfg/bridge-spawn");
  assert.equal(codex({}).bridgeSpawnDir(HOME), null);
});

test("bridgePointerFile: <transcriptsRoot>/<cwd slug>/bridge-pointer.json on Claude Code (freedom-remotecontrol.mjs:529), null on Codex", () => {
  const cc = claudeCode({});
  assert.equal(cc.bridgePointerFile(HOME, "/w"), "/Users/someone/.claude/projects/-w/bridge-pointer.json");
  assert.equal(cc.bridgePointerFile(HOME, "/Users/someone/Documents/github-repos/garys-freedom"),
    "/Users/someone/.claude/projects/-Users-someone-Documents-github-repos-garys-freedom/bridge-pointer.json");
  // The same slug as the transcripts, so the pointer sits beside the session records.
  assert.equal(dirname(cc.bridgePointerFile(HOME, "/a/b.c")), dirname(cc.transcriptPath(HOME, "/a/b.c", "s")));
  assert.equal(claudeCode({ CLAUDE_CONFIG_DIR: "/cfg" }).bridgePointerFile(HOME, "/w"), "/cfg/projects/-w/bridge-pointer.json");
  assert.equal(cc.bridgePointerFile(HOME, ""), null);
  assert.equal(cc.bridgePointerFile("", "/w"), null);
  assert.equal(codex({}).bridgePointerFile(HOME, "/w"), null);
});

// ---------------------------------------------------------------------------
// isInsidePluginFolder, against Freedom's two copies of the same test
// ---------------------------------------------------------------------------

// Copied from freedom-dev .agents/lib/freedom-workspace.mjs:183. freedom_self.py:66 is the same
// test in Python with os.sep, which is `sep` here.
const freedomInPluginCache = (p) =>
  p.includes(`${sep}.claude${sep}plugins${sep}`) || p.includes(`${sep}plugins${sep}cache${sep}`);

const CORPUS = (home) => [
  `${home}/.claude/plugins/cache/freedom/freedom/9.2.0/.agents`,
  `${home}/.claude/plugins/marketplaces/freedom-workspace`,
  `${home}/.claude/plugins/marketplaces`,
  `${home}/.claude/plugins/cache`,
  `${home}/.claude/plugins`,
  `${home}/.claude/plugins/`,
  `${home}/.claude/skills/x`,
  `${home}/.codex/plugins/cache/freedom/9.2.0`,
  `${home}/.codex/plugins/marketplaces/freedom-workspace`,
  `${home}/.codex/plugins/marketplacesX/y`,
  `${home}/.codex/.tmp/marketplaces/freedom-workspace`,
  `${home}/Documents/github-repos/garys-freedom`,
  "/opt/plugins/cache/thing",
  "/opt/plugins/cache",
  "plugins/cache/rel",
  ".claude/plugins/rel",
  "/x/.claude/plugins/y",
  "C:\\Users\\u\\.claude\\plugins\\cache\\x",
  "/a\\.claude\\plugins\\b",
  "/",
  "",
];

test("isInsidePluginFolder on Claude Code, default environment: exactly Freedom's answer for every path", () => {
  for (const home of ["/Users/someone", "/h", "/trailing/"]) {
    const p = claudeCode({});
    for (const path of CORPUS(home.replace(/\/$/, "")))
      assert.equal(p.isInsidePluginFolder(path, home), freedomInPluginCache(path), `${path} with home ${home}`);
  }
});

test("isInsidePluginFolder keeps Freedom's separator rule: a path with the other separator is not matched", () => {
  const other = sep === "/" ? "\\" : "/";
  const path = ["", "Users", "u", ".claude", "plugins", "cache", "x"].join(other);
  for (const p of [claudeCode({}), codex({})]) assert.equal(p.isInsidePluginFolder(path, "/Users/u"), freedomInPluginCache(path));
  assert.equal(claudeCode({}).isInsidePluginFolder(["", "Users", "u", ".claude", "plugins", "cache", "x"].join(sep), "/Users/u"), true);
});

test("isInsidePluginFolder: everything Freedom calls a plugin copy, both harnesses still call one", () => {
  for (const f of [claudeCode, codex])
    for (const env of ENVS)
      for (const path of CORPUS("/h"))
        if (freedomInPluginCache(path)) assert.equal(f(env).isInsidePluginFolder(path, "/h"), true, `${path}`);
});

test("isInsidePluginFolder also answers for the harness's own two folders where Freedom's shape test does not reach", () => {
  const cx = codex({});
  assert.equal(cx.isInsidePluginFolder("/h/.codex/plugins/marketplaces/freedom-workspace", "/h"), true);
  assert.equal(cx.isInsidePluginFolder("/h/.codex/plugins/marketplaces", "/h"), true);
  assert.equal(cx.isInsidePluginFolder("/h/.codex/plugins/cache/f/1", "/h"), true);
  assert.equal(cx.isInsidePluginFolder("/h/.codex/plugins/marketplacesX/y", "/h"), false);
  assert.equal(cx.isInsidePluginFolder("/h/.codex/skills/x", "/h"), false);
  assert.equal(cx.isInsidePluginFolder("/h/Documents/work", "/h"), false);
  const moved = codex({ CODEX_HOME: "/cx" });
  assert.equal(moved.isInsidePluginFolder("/cx/plugins/marketplaces/m", "/h"), true);
  const cfg = claudeCode({ CLAUDE_CONFIG_DIR: "/cfg" });
  assert.equal(cfg.isInsidePluginFolder("/cfg/plugins/marketplaces/m", "/h"), true);
  assert.equal(cfg.isInsidePluginFolder("/cfg/skills/m", "/h"), false);
  // Without a home, only the shape test answers.
  assert.equal(cx.isInsidePluginFolder("/h/.codex/plugins/marketplaces/m"), false);
  assert.equal(cx.isInsidePluginFolder("/h/.codex/plugins/cache/m"), true);
});

test("isInsidePluginFolder never throws and answers false for anything that is not a path", () => {
  for (const p of [claudeCode({}), codex({})])
    for (const bad of [undefined, null, 42, {}, [], ""]) assert.equal(p.isInsidePluginFolder(bad, "/h"), false);
});

// ---------------------------------------------------------------------------
// The clauses, and the check
// ---------------------------------------------------------------------------

test("the six new places are optional clauses of the standard, each with its sentence", () => {
  for (const key of NEW_KEYS) {
    const c = CLAUSES.find((c) => c.id === `places.${key}`);
    assert.ok(c, `no clause places.${key}`);
    assert.equal(c.level, "optional", key);
    assert.ok(c.says.length > 20, key);
  }
  assert.equal(CLAUSES.find((c) => c.id === "places.isInsidePluginFolder").kind, "predicate");
  assert.match(CLAUSES.find((c) => c.id === "places.projectDir").says, /Codex|null/);
});

test("both shipped adapters pass every new clause, and stay superharnesses", () => {
  for (const p of [claudeCode({}), codex({})]) {
    const rows = checkStatic(p);
    for (const key of NEW_KEYS) {
      const r = rows.find((r) => r.id === `places.${key}`);
      assert.equal(r.ok, true, `${p.id} ${key}: ${r.why}`);
      assert.notEqual(r.why, "not provided", `${p.id} does not answer ${key}`);
    }
    const s = summarize(rows);
    assert.equal(s.pass, true);
    assert.equal(s.superharness, true);
    assert.deepEqual(s.failed, []);
  }
});

test("a malformed plugin-folder test fails its clause; a missing one is not provided", () => {
  const base = PROFILES.codex;
  const row = (over) => checkStatic({ ...base, ...over }).find((r) => r.id === "places.isInsidePluginFolder");
  assert.equal(row({ isInsidePluginFolder: () => "yes" }).ok, false);
  assert.equal(row({ isInsidePluginFolder: () => { throw new Error("boom"); } }).ok, false);
  assert.equal(row({ isInsidePluginFolder: "no" }).ok, false);
  assert.deepEqual([row({ isInsidePluginFolder: undefined }).ok, row({ isInsidePluginFolder: undefined }).why], [true, "not provided"]);
  assert.equal(row({ isInsidePluginFolder: () => false }).ok, true);
});

test("the purity row still holds with the new places, and catches one that reads process.env", () => {
  for (const p of [claudeCode({}), codex({})]) assert.equal(checkStatic(p).find((r) => r.id === "purity").ok, true);
  const leaky = { ...PROFILES["claude-code"], bridgePointerFile: () => process.env.HOME };
  assert.match(checkStatic(leaky).find((r) => r.id === "purity").why, /bridgePointerFile/);
});
