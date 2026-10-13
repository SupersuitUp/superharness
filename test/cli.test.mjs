// The CLI, run the way a shell script or a Python script would run it: a child process with a
// scrubbed environment and a throwaway home. Nothing here starts a harness.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIN = join(ROOT, "bin", "harness-harnesser.mjs");
const tmp = mkdtempSync(join(tmpdir(), "hh-cli-"));
const brokenFile = join(tmp, "broken.mjs");
writeFileSync(brokenFile, `export default () => ({ id: "broken", label: "Broken",
  configDir: (h) => h + "/.broken", transcriptsRoot: (h) => h + "/.broken/log",
  bin: () => "broken-harness-that-is-not-installed", deliverIdentity: { via: "hook-context" },
  moments: { sessionStart: "Start" } });`);
const toyFile = join(tmp, "toy.mjs");
writeFileSync(toyFile, `export default () => ({ id: "toy", label: "Toy",
  configDir: (h) => h + "/.toy", skillsDir: (h) => h + "/.toy/skills",
  transcriptsRoot: (h) => h + "/.toy/log", bin: () => "toy-harness-that-is-not-installed",
  deliverIdentity: { via: "hook-context" }, moments: { sessionStart: "Start" } });`);

const run = (args, env = {}) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: tmp, ...env } });
test("list names both harnesses", () => { const r = run(["list"]); assert.equal(r.status, 0); assert.match(r.stdout, /claude-code/); assert.match(r.stdout, /codex/); });
test("which honours the environment override", () => { assert.match(run(["which"], { FREEDOM_HARNESS: "codex" }).stdout, /^codex/); });
test("path prints the place and nothing else", () => { assert.equal(run(["path", "skillsDir", "--harness", "claude-code"]).stdout.trim(), join(tmp, ".claude", "skills")); });
test("path exits 1 when the harness has no such place", () => { assert.equal(run(["path", "sessionsDir", "--harness", "codex"]).status, 1); });
test("can exits 0 for yes and 1 otherwise", () => { assert.equal(run(["can", "phone", "--harness", "claude-code"]).status, 0); const r = run(["can", "phone", "--harness", "codex"]); assert.equal(r.status, 1); assert.match(r.stdout, /unmeasured/); });
test("check passes both builtins and fails a broken file with the clause named", () => { assert.equal(run(["check", "claude-code"]).status, 0); assert.equal(run(["check", "codex"]).status, 0); const r = run(["check", brokenFile]); assert.equal(r.status, 1); assert.match(r.stdout, /FAIL\s+places\.skillsDir/); });
test("check --json is machine readable", () => { const j = JSON.parse(run(["check", "codex", "--json"]).stdout); assert.equal(j.pass, true); assert.equal(j.contract, "1.0.0"); });
test("warn prints the phone line warning for codex and nothing for claude-code", () => { assert.match(run(["warn", "codex"]).stdout, /phone/); assert.equal(run(["warn", "claude-code"]).stdout, ""); });
test("an unknown command is a usage error", () => { assert.equal(run(["frobnicate"]).status, 2); });

// ---------------------------------------------------------------------------
// The rest of the surface
// ---------------------------------------------------------------------------

test("--help prints every command and exits 0; no arguments is a usage error that prints the same help", () => {
  const h = run(["--help"]);
  assert.equal(h.status, 0);
  for (const c of ["list", "which", "path", "can", "check", "rubric", "warn", "--json", "--version"]) assert.ok(h.stdout.includes(c), c);
  const none = run([]);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /Usage/);
});
test("--version prints the package version and the contract version", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const r = run(["--version"]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), `${pkg.version} (contract 1.0.0)`);
});
test("list --json and which --json are machine readable, and which defaults to claude-code", () => {
  assert.deepEqual(JSON.parse(run(["list", "--json"]).stdout).map((h) => h.id), ["claude-code", "codex"]);
  const w = JSON.parse(run(["which", "--json"]).stdout);
  assert.equal(w.id, "claude-code");
  assert.equal(w.swapped, false);
  assert.equal(run(["which"]).stdout.trim(), "claude-code");
});
test("which reads the machine config under the home it is given", () => {
  const home = mkdtempSync(join(tmpdir(), "hh-cfg-"));
  spawnSync("mkdir", ["-p", join(home, ".freedom")]);
  writeFileSync(join(home, ".freedom", "config.json"), JSON.stringify({ harness: "codex" }));
  assert.equal(run(["which", "--home", home]).stdout.trim(), "codex");
  assert.equal(run(["which"], { HOME: home }).stdout.trim(), "codex");
});
test("path takes --home, uses the resolved harness by default, and computes a transcript path", () => {
  assert.equal(run(["path", "configDir", "--home", "/h"], { FREEDOM_HARNESS: "codex" }).stdout, "/h/.codex\n");
  assert.equal(run(["path", "configDir", "--home", "/h"], { CLAUDE_CONFIG_DIR: "/cfg" }).stdout, "/cfg\n");
  assert.equal(run(["path", "transcriptPath", "--harness", "claude-code", "--home", "/h", "--cwd", "/a/b", "--session", "s1"]).stdout,
    "/h/.claude/projects/-a-b/s1.jsonl\n");
  assert.equal(run(["path", "worktreesDir", "--harness", "codex", "--root", "/repo"]).stdout, "/repo/.claude/worktrees\n");
});
test("path with an unknown place, or with no place, is a usage error", () => {
  assert.equal(run(["path", "nowhere"]).status, 2);
  assert.equal(run(["path"]).status, 2);
});
test("can prints the answer for a measured no and for an ability nobody declared", () => {
  const no = run(["can", "slashCommands", "--harness", "codex"]);
  assert.equal(no.stdout.trim(), "no");
  assert.equal(no.status, 1);
  const unknown = run(["can", "teleport", "--harness", "claude-code"]);
  assert.equal(unknown.stdout.trim(), "unmeasured");
  assert.equal(unknown.status, 1);
  assert.equal(run(["can", "phone", "--harness", "claude-code"]).stdout.trim(), "yes");
});
test("--harness takes a file as well as an id, and a harness that cannot be loaded is a usage error", () => {
  assert.equal(run(["path", "skillsDir", "--harness", toyFile, "--home", "/h"]).stdout, "/h/.toy/skills\n");
  const bad = run(["can", "phone", "--harness", "no-such-harness"]);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /no-such-harness/);
});
test("check prints one line per clause and a summary line, and an outside file can pass", () => {
  const r = run(["check", toyFile]);
  assert.equal(r.status, 0);
  const lines = r.stdout.trim().split("\n");
  assert.match(lines[0], /^PASS\s+places\.configDir\s+core/);
  assert.match(lines.at(-1), /^PASS toy: contract 1\.0\.0, core 7 of 7, optional \d+ of \d+$/);
  const broken = run(["check", brokenFile]).stdout.trim().split("\n");
  assert.match(broken.at(-1), /^FAIL broken: contract 1\.0\.0, core 6 of 7, optional \d+ of \d+, failed: places\.skillsDir$/);
});
test("check --live skips a harness that is not installed, and still passes on the static half", () => {
  const r = run(["check", toyFile, "--live"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /SKIP\s+live\.bin\s+optional\s+harness not installed/);
  assert.match(r.stdout, /SKIP\s+live\.session\.hookFires/);
  const j = JSON.parse(run(["check", toyFile, "--live", "--json"]).stdout);
  assert.equal(j.results.find((x) => x.id === "live.bin").ok, null);
});
test("check with no target is a usage error", () => { assert.equal(run(["check"]).status, 2); });
test("rubric prints both scorecards, and --needs adds the recommendation as the last line", () => {
  const r = run(["rubric"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Claude Code\s+13\.6 of 14/);
  assert.match(r.stdout, /Codex\s+8\.7 of 14/);
  assert.match(r.stdout, /not measured/);
  const n = run(["rubric", "--needs", "phone"]);
  assert.match(n.stdout.trim().split("\n").at(-1), /^Claude Code, because you need a line to your phone/);
  const j = JSON.parse(run(["rubric", "--json", "--needs", "phone,mcp"]).stdout);
  assert.equal(j.recommendation.pick, "claude-code");
  assert.deepEqual(j.harnesses.map((h) => h.id), ["claude-code", "codex"]);
  assert.deepEqual(j.modelResults, []);
});
test("rubric exits 1 when a need was named and nothing meets it", () => {
  const r = run(["rubric", "--needs", "phone", "--harness", "codex"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /No pick/);
});
test("warn takes a file, and names the harnesses that have a measured line", () => {
  const r = run(["warn", toyFile]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim().split("\n").length, 3);
  assert.match(r.stdout, /Toy/);
  assert.match(r.stdout, /Claude Code/);
});
