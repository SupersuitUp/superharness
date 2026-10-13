// The documents and the data say the same thing, and the prose keeps the package's rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STANDARD_VERSION, CLAUSES } from "../src/contract.mjs";
import { BAR, DEFINITION } from "../src/bar.mjs";
import { HARNESS_ROWS, MODEL_ROWS } from "../src/rubric.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");
const PROSE = ["STANDARD.md", "RUBRIC.md", "README.md", "CHANGELOG.md"];
const SOURCE = ["src/contract.mjs", "src/bar.mjs", "src/card.mjs", "src/define.mjs", "src/registry.mjs", "src/conformance.mjs", "src/rubric.mjs",
  "src/bin-resolver.mjs", "src/adapters/claude-code.mjs", "src/adapters/codex.mjs", "src/index.mjs", "bin/superharness.mjs"];

test("STANDARD.md is titled as the standard and carries the definition sentence", () => {
  const doc = read("STANDARD.md");
  assert.match(doc, /^# The superharness standard$/m);
  assert.ok(doc.includes(DEFINITION));
  assert.ok(read("README.md").includes(DEFINITION));
});
test("STANDARD.md carries all eleven boxes, numbered, in two halves, each with its sentence and what it reads", () => {
  const doc = read("STANDARD.md");
  BAR.forEach((b, i) => {
    const line = doc.split("\n").find((l) => l.startsWith(`${i + 1}. \`${b.id}\`: `));
    assert.ok(line, `STANDARD.md is missing box ${i + 1}, ${b.id}`);
    assert.ok(line.includes(b.says), `STANDARD.md does not carry the sentence for ${b.id}`);
    const row = doc.split("\n").find((l) => l.startsWith("| `" + b.id + "` |"));
    assert.ok(row, `STANDARD.md has no "how it is decided" row for ${b.id}`);
    for (const n of b.needs) assert.ok(row.includes("`" + n + "`"), `${b.id}'s row does not name ${n}`);
  });
  assert.ok(doc.indexOf("### Capability") < doc.indexOf("### Safety"));
  assert.ok(doc.indexOf("`helpers`") < doc.indexOf("### Safety") && doc.indexOf("### Safety") < doc.indexOf("7. `refuses`"));
});
test("every clause id in the standard appears in STANDARD.md, with its sentence", () => {
  const doc = read("STANDARD.md");
  for (const c of CLAUSES) {
    assert.ok(doc.includes("`" + c.id + "`"), `STANDARD.md is missing ${c.id}`);
    assert.ok(doc.includes(c.says), `STANDARD.md does not carry the sentence for ${c.id}`);
  }
});
test("STANDARD.md marks each clause core or optional the way the data does", () => {
  const doc = read("STANDARD.md");
  for (const c of CLAUSES) {
    const line = doc.split("\n").find((l) => l.startsWith("- `" + c.id + "`"));
    assert.ok(line.includes("`" + c.id + "` (" + c.level + ")"), `${c.id} should read ${c.level}: ${line}`);
  }
});
test("STANDARD.md's version line equals STANDARD_VERSION", () => {
  const m = read("STANDARD.md").match(/^\*\*Version (\d+\.\d+\.\d+)\*\*/m);
  assert.ok(m, "no version line");
  assert.equal(m[1], STANDARD_VERSION);
});
test("a person reads remote control, never the old words for it", () => {
  const changelogNow = read("CHANGELOG.md").split(/^## 0\.1\.1$/m)[0];
  for (const [f, text] of [...["STANDARD.md", "RUBRIC.md", "README.md"].map((f) => [f, read(f)]), ["CHANGELOG.md 0.2.0", changelogNow],
    ...SOURCE.map((f) => [f, read(f)])]) {
    assert.ok(!/phone line|line to (your|their|a) phone|measured line/i.test(text), `${f} still says phone line`);
  }
  for (const f of ["STANDARD.md", "RUBRIC.md", "README.md"]) assert.match(read(f), /remote control/i, f);
});
test("the old package name survives only in the changelog", () => {
  for (const f of ["STANDARD.md", "RUBRIC.md", "README.md", "package.json", ".github/workflows/ci.yml", ".github/workflows/publish.yml", ...SOURCE])
    assert.ok(!/harness-harnesser|CONTRACT\.md/.test(read(f)), `${f} still carries the old name`);
  assert.match(read("CHANGELOG.md"), /harness-harnesser/);
});
test("the package is named for the standard, and its bin file exists under that name", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.name, "@supersuit/superharness");
  assert.deepEqual(pkg.bin, { superharness: "bin/superharness.mjs" });
  assert.match(pkg.repository.url, /SupersuitUp\/superharness\.git$/);
  assert.ok(read("bin/superharness.mjs").startsWith("#!/usr/bin/env node"));
  assert.ok(read("CHANGELOG.md").includes(`## ${pkg.version}`));
});
test("RUBRIC.md names every row with its weight", () => {
  const doc = read("RUBRIC.md");
  for (const r of [...HARNESS_ROWS, ...MODEL_ROWS]) {
    const line = doc.split("\n").find((l) => l.startsWith("| `" + r.id + "` |") && l.includes(r.feels));
    assert.ok(line, `RUBRIC.md is missing the row ${r.id} with its sentence`);
    assert.ok(line.includes(`| ${r.weight} |`), `${r.id} should carry weight ${r.weight}`);
  }
  for (const r of MODEL_ROWS) assert.ok(doc.includes(r.task), `RUBRIC.md is missing the task for ${r.id}`);
  assert.ok(doc.includes("A row with no measurement scores nothing and is shown as not measured."));
});
test("RUBRIC.md defines moldability and steerability, lists their rows, and says how the measured rows are produced", async () => {
  const { MOLDABILITY, STEERABILITY } = await import("../src/rubric.mjs");
  const doc = read("RUBRIC.md");
  assert.ok(doc.includes(MOLDABILITY));
  assert.ok(doc.includes(STEERABILITY));
  assert.ok(!/harnessab/i.test(doc + read("STANDARD.md") + read("README.md")), "the retired word is back");
  const section = doc.split(/^## Moldability and steerability$/m)[1]?.split(/^## /m)[0];
  assert.ok(section, "no Moldability and steerability section");
  for (const r of HARNESS_ROWS.filter((r) => r.quality !== "reach")) assert.ok(section.includes("`" + r.id + "`"), r.id);
  for (const r of HARNESS_ROWS.filter((r) => r.quality === "reach")) assert.ok(!section.includes("| `" + r.id + "` |"), r.id);
  for (const words of ["No hint", "away from the desk", "by name", "three runs", "without the task being stopped"]) assert.ok(doc.includes(words), words);
  assert.match(read("STANDARD.md"), /floor of moldability/);
});
test("no prose file contains an em dash", () => {
  for (const f of PROSE) assert.ok(!read(f).includes("—"), `${f} has an em dash`);
});
test("no prose file names a harness other than the two shipped", () => {
  for (const f of PROSE)
    for (const w of ["cursor", "gemini", "opencode", "copilot", "windsurf"])
      assert.ok(!new RegExp(w, "i").test(read(f)), `${f} names ${w}`);
});
test("no source file names a harness other than the two shipped", () => {
  for (const f of SOURCE)
    for (const w of ["cursor", "gemini", "opencode", "copilot", "windsurf"])
      assert.ok(!new RegExp(w, "i").test(read(f)), `${f} names ${w}`);
});
test("the README shows every command", () => {
  const doc = read("README.md");
  for (const c of ["list", "which", "path", "can", "check", "bar", "rubric", "warn", "--help"])
    assert.ok(doc.includes(`superharness ${c}`), `README.md does not show ${c}`);
});
test("the package ships the two documents the standard is made of", () => {
  const pkg = JSON.parse(read("package.json"));
  for (const f of ["STANDARD.md", "RUBRIC.md"]) assert.ok(pkg.files.includes(f), `${f} is not in package.json files`);
  assert.deepEqual(pkg.dependencies, {});
});

// ---------------------------------------------------------------------------
// The examples in the documents are run, so they cannot drift from the code
// ---------------------------------------------------------------------------

const { mkdtempSync, writeFileSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
const { spawnSync } = await import("node:child_process");
const { loadAdapter } = await import("../src/registry.mjs");
const { checkBar, isSuperharness } = await import("../src/bar.mjs");

/** The first fenced js block in a document that starts with the given comment line. */
const block = (file, firstLine) => {
  const m = read(file).split("```js\n").map((b) => b.split("\n```")[0]).find((b) => b.startsWith(firstLine));
  assert.ok(m, `${file} has no js block starting with ${firstLine}`);
  return m;
};
const exampleDir = mkdtempSync(join(tmpdir(), "sh-docs-"));
const cli = (args) => spawnSync(process.execPath, [join(ROOT, "bin", "superharness.mjs"), ...args],
  { encoding: "utf8", env: { PATH: process.env.PATH, HOME: exampleDir } });

test("the adapter STANDARD.md teaches is a superharness when it is saved and checked", async () => {
  const file = join(exampleDir, "toy.mjs");
  writeFileSync(file, block("STANDARD.md", "// toy.mjs"));
  const p = (await loadAdapter(file))({});
  assert.deepEqual(checkBar(p).filter((b) => !b.ok).map((b) => b.id), []);
  assert.equal(isSuperharness(p), true);
  const r = cli(["check", file]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim().split("\n").at(-1), "SUPERHARNESS toy: 11 of 11 (standard 2.0.0)");
});
test("the starter adapter in the README prints exactly the lines the README shows", () => {
  const file = join(exampleDir, "small.mjs");
  writeFileSync(file, block("README.md", "// small.mjs"));
  const doc = read("README.md");
  const check = cli(["check", file]);
  assert.equal(check.status, 1);
  for (const line of check.stdout.trim().split("\n").slice(-3)) assert.ok(doc.includes(line), `README.md does not show: ${line}`);
  const warn = cli(["warn", file]).stdout.trim().split("\n");
  assert.equal(warn.length, 3);
  for (const line of warn) assert.ok(doc.includes(line), `README.md does not show: ${line}`);
});
test("the bar the README shows for each shipped harness is what the command prints", () => {
  const doc = read("README.md");
  for (const id of ["claude-code", "codex"])
    for (const line of cli(["bar", id]).stdout.trim().split("\n")) assert.ok(doc.includes(line), `README.md does not show: ${line}`);
  for (const id of ["claude-code", "codex"]) {
    const last = cli(["check", id]).stdout.trim().split("\n").at(-1);
    assert.ok(read("STANDARD.md").includes(last.replace(id, "toy")) , last);
  }
  assert.ok(doc.includes(cli(["check", "codex"]).stdout.trim().split("\n").at(-1)));
  assert.ok(doc.includes(cli(["--version"]).stdout.trim()));
  assert.ok(doc.includes(cli(["rubric", "--needs", "liveSessionRegistry"]).stdout.trim().split("\n").at(-1)));
});
test("the totals RUBRIC.md states are the totals the code computes", async () => {
  const { scoreHarness } = await import("../src/rubric.mjs");
  const { PROFILES } = await import("../src/registry.mjs");
  const cc = scoreHarness(PROFILES["claude-code"]), cx = scoreHarness(PROFILES.codex);
  assert.ok(read("RUBRIC.md").includes(`| **Total** | **${cc.total} of ${cc.max}** | **${cx.total} of ${cx.max}** |`));
});

// Freedom vendors this package and scans its payload. Two of its scanners read plain text: one
// counts literals that look like Freedom's own version, one reads `label =` as a launchd label.
// Both fired on the first vendored copy (2026-10-13), so the source stays clear of both shapes.
test("no source file carries a consumer's version number or a `label =` assignment", () => {
  for (const f of ["src/bin-resolver.mjs", "src/registry.mjs", "src/rubric.mjs", "src/conformance.mjs", "src/define.mjs", "src/contract.mjs", "src/bar.mjs", "src/adapters/claude-code.mjs", "src/adapters/codex.mjs", "bin/superharness.mjs"]) {
    const s = read(f);
    assert.ok(!/\bv6\.\d+\.\d+/.test(s), `${f} names a Freedom version`);
    assert.ok(!/\blabel\s*=\s*/i.test(s), `${f} has a label = assignment`);
    assert.ok(!/toISOString/.test(s), `${f} derives a day from a UTC timestamp`);
  }
});

test("a measured date has to be a real calendar day", async () => {
  const { evidencedYes } = await import("../src/bar.mjs");
  const y = (measured) => ({ answer: "yes", measured, version: "1", evidence: "seen" });
  assert.equal(evidencedYes(y("2026-10-13")), true);
  assert.equal(evidencedYes(y("2024-02-29")), true);
  for (const bad of ["2026-02-30", "2026-13-01", "2026-00-10", "2025-02-29", "2026-1-3", "tomorrow"])
    assert.equal(evidencedYes(y(bad)), false, bad);
});
