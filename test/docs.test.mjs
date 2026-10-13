// The documents and the data say the same thing, and the prose keeps the package's rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTRACT_VERSION, CLAUSES } from "../src/contract.mjs";
import { HARNESS_ROWS, MODEL_ROWS } from "../src/rubric.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");
const PROSE = ["CONTRACT.md", "RUBRIC.md", "README.md", "CHANGELOG.md"];

test("every clause id in the contract appears in CONTRACT.md, with its sentence", () => {
  const doc = read("CONTRACT.md");
  for (const c of CLAUSES) {
    assert.ok(doc.includes("`" + c.id + "`"), `CONTRACT.md is missing ${c.id}`);
    assert.ok(doc.includes(c.says), `CONTRACT.md does not carry the sentence for ${c.id}`);
  }
});
test("CONTRACT.md marks each clause core or optional the way the data does", () => {
  const doc = read("CONTRACT.md");
  for (const c of CLAUSES) {
    const line = doc.split("\n").find((l) => l.includes("`" + c.id + "`"));
    assert.ok(line.includes("`" + c.id + "` (" + c.level + ")"), `${c.id} should read ${c.level}: ${line}`);
  }
});
test("CONTRACT.md's version line equals CONTRACT_VERSION", () => {
  const m = read("CONTRACT.md").match(/^\*\*Version (\d+\.\d+\.\d+)\*\*/m);
  assert.ok(m, "no version line");
  assert.equal(m[1], CONTRACT_VERSION);
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
test("no prose file contains an em dash", () => {
  for (const f of PROSE) assert.ok(!read(f).includes("—"), `${f} has an em dash`);
});
test("no prose file names a harness other than the two shipped", () => {
  for (const f of PROSE)
    for (const w of ["cursor", "gemini", "opencode", "copilot", "windsurf"])
      assert.ok(!new RegExp(w, "i").test(read(f)), `${f} names ${w}`);
});
test("no source file names a harness other than the two shipped", () => {
  for (const f of ["src/contract.mjs", "src/define.mjs", "src/registry.mjs", "src/conformance.mjs", "src/rubric.mjs",
    "src/bin-resolver.mjs", "src/adapters/claude-code.mjs", "src/adapters/codex.mjs", "src/index.mjs", "bin/harness-harnesser.mjs"])
    for (const w of ["cursor", "gemini", "opencode", "copilot", "windsurf"])
      assert.ok(!new RegExp(w, "i").test(read(f)), `${f} names ${w}`);
});
test("the README shows every command", () => {
  const doc = read("README.md");
  for (const c of ["list", "which", "path", "can", "check", "rubric", "warn", "--help"])
    assert.ok(doc.includes(`harness-harnesser ${c}`), `README.md does not show ${c}`);
});
test("the package ships the two documents the contract is made of", () => {
  const pkg = JSON.parse(read("package.json"));
  for (const f of ["CONTRACT.md", "RUBRIC.md"]) assert.ok(pkg.files.includes(f), `${f} is not in package.json files`);
  assert.deepEqual(pkg.dependencies, {});
});
