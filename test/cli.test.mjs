// The CLI, run the way a shell script or a Python script would run it: a child process with a
// scrubbed environment and a throwaway home. Nothing here starts a harness.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPER_TOY_FILE } from "./fixtures.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIN = join(ROOT, "bin", "superharness.mjs");
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

const superFile = join(tmp, "supertoy.mjs");
writeFileSync(superFile, SUPER_TOY_FILE);

const run = (args, env = {}) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: tmp, ...env } });
test("list names both harnesses", () => { const r = run(["list"]); assert.equal(r.status, 0); assert.match(r.stdout, /claude-code/); assert.match(r.stdout, /codex/); });
test("which honours the environment override", () => { assert.match(run(["which"], { FREEDOM_HARNESS: "codex" }).stdout, /^codex/); });
test("path prints the place and nothing else", () => { assert.equal(run(["path", "skillsDir", "--harness", "claude-code"]).stdout.trim(), join(tmp, ".claude", "skills")); });
test("path exits 1 when the harness has no such place", () => { assert.equal(run(["path", "sessionsDir", "--harness", "codex"]).status, 1); });
test("can exits 0 for yes and 1 otherwise", () => { assert.equal(run(["can", "phone", "--harness", "claude-code"]).status, 0); assert.equal(run(["can", "phone", "--harness", "codex"]).status, 0); const r = run(["can", "pluginHooks", "--harness", "codex"]); assert.equal(r.status, 1); assert.match(r.stdout, /unmeasured/); });
test("can answers for remoteControl exactly as it does for phone", () => {
  for (const h of ["claude-code", "codex", toyFile]) {
    const a = run(["can", "phone", "--harness", h]), b = run(["can", "remoteControl", "--harness", h]);
    assert.equal(a.stdout, b.stdout, h);
    assert.equal(a.status, b.status, h);
  }
  assert.equal(run(["can", "remoteControl", "--harness", toyFile]).status, 1);
});
test("check passes both builtins and fails a broken file with the clause named", () => { assert.equal(run(["check", "claude-code"]).status, 0); assert.equal(run(["check", "codex"]).status, 0); const r = run(["check", brokenFile]); assert.equal(r.status, 1); assert.match(r.stdout, /FAIL\s+places\.skillsDir/); });
test("check --json is machine readable", () => {
  const j = JSON.parse(run(["check", "codex", "--json"]).stdout);
  assert.equal(j.pass, true);
  assert.equal(j.standard, "2.1.0");
  assert.equal(j.contract, "2.1.0", "the old key is kept for a reader that has not moved");
  assert.equal(j.superharness, true);
  assert.deepEqual(j.bar, { ok: 11, total: 11, missing: [] });
  assert.equal(j.boxes.length, 11);
});
test("warn prints nothing for either shipped harness, since both have remote control measured", () => { assert.equal(run(["warn", "codex"]).stdout, ""); assert.equal(run(["warn", "claude-code"]).stdout, ""); });

// ---------------------------------------------------------------------------
// The bar
// ---------------------------------------------------------------------------

test("check ends with one line per box and then SUPERHARNESS, for both shipped harnesses", () => {
  for (const id of ["claude-code", "codex"]) {
    const r = run(["check", id]);
    assert.equal(r.status, 0, id);
    const lines = r.stdout.trim().split("\n");
    assert.equal(lines.at(-1), `SUPERHARNESS ${id}: 11 of 11 (standard 2.1.0)`);
    const boxes = lines.slice(-12, -1);
    assert.equal(boxes.length, 11);
    for (const l of boxes) assert.match(l, /^PASS  \w+\s+(capability|safety)\s+\S/, l);
    assert.match(lines.at(-13), /^clauses: core 7 of 7, optional \d+ of \d+$/);
  }
});
test("check says NOT A SUPERHARNESS with the count and the missing boxes, and exits 1", () => {
  const r = run(["check", toyFile]);
  assert.equal(r.status, 1);
  assert.equal(r.stdout.trim().split("\n").at(-1),
    "NOT A SUPERHARNESS toy: 3 of 11, missing: tools, unattended, helpers, refuses, permission, record, remoteControl, questionCard");
  assert.match(r.stdout, /^FAIL  tools\s+capability\s+It can be given new tools through the open connector standard\. Missing: mcp is not measured\.$/m);
});
test("an outside adapter file that checks all eleven boxes is a superharness", () => {
  const r = run(["check", superFile]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim().split("\n").at(-1), "SUPERHARNESS supertoy: 11 of 11 (standard 2.1.0)");
});
test("bar prints only the eleven lines, and exits 0 only when all eleven are checked", () => {
  for (const id of ["claude-code", "codex", superFile]) {
    const r = run(["bar", id]);
    assert.equal(r.status, 0, id);
    const lines = r.stdout.trim().split("\n");
    assert.equal(lines.length, 11);
    assert.deepEqual(lines.map((l) => l.split(/\s+/)[1]), ["computer", "instructions", "skills", "tools", "unattended", "helpers",
      "refuses", "permission", "record", "remoteControl", "questionCard"]);
    assert.ok(lines.every((l) => l.startsWith("PASS  ")));
  }
  const toy = run(["bar", toyFile]);
  assert.equal(toy.status, 1);
  assert.equal(toy.stdout.trim().split("\n").length, 11);
  assert.equal(toy.stdout.trim().split("\n").filter((l) => l.startsWith("FAIL  ")).length, 8);
  assert.match(toy.stdout, /^FAIL  remoteControl\s+safety\s+You can reach it from your phone: .* Missing: remote control is not measured\.$/m);
  assert.equal(run(["bar"]).status, 2);
});
test("bar --json is machine readable", () => {
  const j = JSON.parse(run(["bar", "codex", "--json"]).stdout);
  assert.equal(j.harness, "codex");
  assert.equal(j.standard, "2.1.0");
  assert.equal(j.superharness, true);
  assert.deepEqual(j.bar, { ok: 11, total: 11, missing: [] });
  assert.equal(j.boxes.length, 11);
  for (const b of j.boxes) assert.ok(b.id && b.half && b.says && b.why && b.ok === true, b.id);
  const t = JSON.parse(run(["bar", toyFile, "--json"]).stdout);
  assert.equal(t.superharness, false);
  assert.equal(t.bar.ok, 3);
});
test("an unknown command is a usage error", () => { assert.equal(run(["frobnicate"]).status, 2); });

// ---------------------------------------------------------------------------
// The rest of the surface
// ---------------------------------------------------------------------------

test("--help prints every command and exits 0; no arguments is a usage error that prints the same help", () => {
  const h = run(["--help"]);
  assert.equal(h.status, 0);
  for (const c of ["list", "which", "path", "can", "check", "bar", "rubric", "warn", "--json", "--version"]) assert.ok(h.stdout.includes(c), c);
  assert.match(h.stdout, /A superharness is a harness you can hand your whole computer/);
  assert.match(h.stdout, /remote control/);
  assert.ok(!/phone line/.test(h.stdout));
  const none = run([]);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /Usage/);
});
test("--version prints the package version and the standard version", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const r = run(["--version"]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), `${pkg.version} (standard 2.1.0)`);
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
test("path answers the 0.3.0 places: projectDir takes --root, bridgePointerFile takes --cwd", () => {
  assert.equal(run(["path", "projectDir", "--harness", "codex", "--root", "/repo"]).stdout, "/repo/.codex\n");
  assert.equal(run(["path", "projectDir", "--harness", "claude-code", "--root", "/repo"]).stdout, "/repo/.claude\n");
  assert.equal(run(["path", "userInstructionsFile", "--harness", "codex", "--home", "/h"]).stdout, "/h/.codex/AGENTS.md\n");
  assert.equal(run(["path", "credentialsFile", "--harness", "claude-code", "--home", "/h"]).stdout, "/h/.claude/.credentials.json\n");
  assert.equal(run(["path", "credentialsFile", "--harness", "codex", "--home", "/h"]).status, 1);
  assert.equal(run(["path", "bridgeSpawnDir", "--harness", "claude-code", "--home", "/h"]).stdout, "/h/.claude/bridge-spawn\n");
  assert.equal(run(["path", "bridgePointerFile", "--harness", "claude-code", "--home", "/h", "--cwd", "/a/b"]).stdout,
    "/h/.claude/projects/-a-b/bridge-pointer.json\n");
});
test("path refuses isInsidePluginFolder, which answers a question and is not a path", () => {
  const r = run(["path", "isInsidePluginFolder"]);
  assert.equal(r.status, 2);
  assert.doesNotMatch(run(["--help"]).stdout.split("Places:")[1].split(".\n")[0], /isInsidePluginFolder/);
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
test("check prints one line per clause and a clause summary line, and names a failed clause", () => {
  const r = run(["check", toyFile]);
  const lines = r.stdout.trim().split("\n");
  assert.match(lines[0], /^PASS\s+places\.configDir\s+core/);
  assert.match(lines.at(-13), /^clauses: core 7 of 7, optional \d+ of \d+$/);
  const broken = run(["check", brokenFile]).stdout.trim().split("\n");
  assert.match(broken.at(-13), /^clauses: core 6 of 7, optional \d+ of \d+, failed: places\.skillsDir$/);
  assert.equal(broken.at(-1), "NOT A SUPERHARNESS broken: 2 of 11, missing: skills, tools, unattended, helpers, refuses, permission, record, remoteControl, questionCard");
});
test("a superharness with a malformed clause is not passed: the last line names the clause", () => {
  const file = join(tmp, "malformed.mjs");
  writeFileSync(file, SUPER_TOY_FILE.replace('id: "supertoy"', 'id: "malformed", sessionsDir: () => 42'));
  const r = run(["check", file]);
  assert.equal(r.status, 1);
  assert.equal(r.stdout.trim().split("\n").at(-1), "NOT A SUPERHARNESS malformed: 11 of 11, malformed: places.sessionsDir");
});
test("check --live skips a harness that is not installed, and still passes on the static half", () => {
  const r = run(["check", superFile, "--live"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /SKIP\s+live\.bin\s+optional\s+harness not installed/);
  assert.match(r.stdout, /SKIP\s+live\.session\.hookFires/);
  const j = JSON.parse(run(["check", superFile, "--live", "--json"]).stdout);
  assert.equal(j.results.find((x) => x.id === "live.bin").ok, null);
  assert.equal(j.superharness, true);
});
test("check with no target is a usage error", () => { assert.equal(run(["check"]).status, 2); });
test("rubric starts with whether each harness is a superharness, then prints both scorecards", () => {
  const r = run(["rubric"]);
  assert.equal(r.status, 0);
  const lines = r.stdout.split("\n");
  assert.equal(lines[0], "Claude Code: strongly recommended. Superharness, 11 of 11 (standard 2.1.0). Not measured yet: followsStanding");
  assert.equal(lines[1], "Codex: supported. Superharness, 11 of 11 (standard 2.1.0). Measured shortfalls: cardWaits, followsStanding, steersMidTask");
  assert.equal(lines[2], "");
  assert.match(r.stdout, /^Claude Code  20\.6 of 23\n  moldability 6\.6 of 9, steerability 2 of 2, reach 12 of 12$/m);
  assert.match(r.stdout, /^Codex  16\.7 of 23\n  moldability 6\.7 of 9, steerability 0 of 2, reach 10 of 12$/m);
  assert.match(r.stdout, /^\s+0 of 2  It follows my standing instructions without being reminded: not measured$/m);
  assert.match(r.stdout, /^  not measured: followsStanding$/m);
  assert.match(r.stdout, /^\s+0 of 2  A question waits for me as long as it takes: no, measured 2026-10-13 on codex-cli 0\.162\.1$/m);
  assert.match(r.stdout, /I can reach it by remote control from my phone: yes, measured 2026-10-13 on codex-cli 0\.162\.1/);
  const toy = run(["rubric", "--harness", toyFile]).stdout;
  assert.match(toy.split("\n")[0], /^Toy: not a superharness, 3 of 11, missing: tools, /);
  assert.match(toy, /not measured/);
});
test("rubric --needs adds the recommendation as the last line, and --json carries the pass line", () => {
  const n = run(["rubric", "--needs", "phone"]);
  assert.equal(n.status, 0);
  assert.match(n.stdout.trim().split("\n").at(-1), /^Claude Code, because you need remote control and 2 of the 2 superharnesses scored have that measured today/);
  const j = JSON.parse(run(["rubric", "--json", "--needs", "phone,liveSessionRegistry"]).stdout);
  assert.equal(j.recommendation.pick, "claude-code");
  assert.equal(j.standard, "2.1.0");
  assert.deepEqual(j.harnesses.map((h) => [h.id, h.superharness, h.bar.ok]), [["claude-code", true, 11], ["codex", true, 11]]);
  assert.deepEqual(j.modelResults, []);
});
test("rubric exits 1 when a need was named and no superharness meets it", () => {
  const r = run(["rubric", "--needs", "slashCommands", "--harness", "codex"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /No pick/);
  const toy = run(["rubric", "--needs", "mcp", "--harness", toyFile]);
  assert.equal(toy.status, 1);
  assert.match(toy.stdout.trim().split("\n").at(-1), /^No pick: none of the 1 scored is a superharness\. Toy is missing 8 of the 11 boxes/);
});
test("warn takes a file, says remote control, and names the harnesses that have it measured", () => {
  const r = run(["warn", toyFile]);
  assert.equal(r.status, 0);
  const lines = r.stdout.trim().split("\n");
  assert.equal(lines.length, 3);
  for (const l of lines.slice(0, 2)) assert.match(l, /remote control/i, l);
  assert.ok(!/phone line|line to your phone/.test(r.stdout));
  assert.match(r.stdout, /Toy/);
  assert.match(lines[1], /Claude Code and Codex/);
  assert.equal(run(["warn", superFile]).stdout, "");
});
