// The bar: eleven boxes, decided only from what an adapter declares.
import { test } from "node:test";
import assert from "node:assert/strict";
import claudeCode from "../src/adapters/claude-code.mjs";
import codex from "../src/adapters/codex.mjs";
import { defineHarness } from "../src/define.mjs";
import { CLAUSES, STANDARD_VERSION, CONTRACT_VERSION, ABILITIES } from "../src/contract.mjs";
import { BAR, DEFINITION, checkBar, isSuperharness } from "../src/bar.mjs";
import { checkStatic, summarize } from "../src/conformance.mjs";
import { superToy, superSpec, withAbilities, Y } from "./fixtures.mjs";

const SAYS = {
  computer: "It works on your computer: it reads and writes your files and runs programs in folders you choose.",
  instructions: "It loads your instructions whole, every session.",
  skills: "It reads skills from a folder, in the open skill format.",
  tools: "It can be given new tools through the open connector standard.",
  unattended: "It can work while you are not watching, from a single command.",
  helpers: "It can hand work to helper agents.",
  refuses: "It stops before it acts: there is a moment before every tool runs where a rule can say no.",
  permission: "It asks permission, and can be restricted to a list of what it may do without asking.",
  record: "It keeps a full record of every session on your own disk, in a form you can read and take with you.",
  remoteControl: "You can reach it from your phone: start a session, check on one, answer it.",
  questionCard: "It can ask you a question as a card with choices.",
};
const failedIds = (p) => checkBar(p).filter((b) => !b.ok).map((b) => b.id);

test("the standard is version 2.0.0, and CONTRACT_VERSION is kept as its alias", () => {
  assert.equal(STANDARD_VERSION, "2.0.0");
  assert.equal(CONTRACT_VERSION, STANDARD_VERSION);
});
test("the definition is the one sentence", () => {
  assert.equal(DEFINITION, "A superharness is a harness you can hand your whole computer and your whole context to, and still be the one in command.");
});
test("the bar is eleven boxes in two halves, in order, with the plain sentences", () => {
  assert.deepEqual(BAR.map((b) => b.id), Object.keys(SAYS));
  assert.deepEqual(BAR.map((b) => b.half), [...Array(6).fill("capability"), ...Array(5).fill("safety")]);
  for (const b of BAR) {
    assert.equal(b.says, SAYS[b.id], b.id);
    assert.ok(!b.says.includes("—"), b.id);
    assert.ok(Array.isArray(b.needs) && b.needs.length > 0, b.id);
  }
});
test("every box names the clauses it reads, and each one is a clause of the standard", () => {
  const ids = new Set(CLAUSES.map((c) => c.id));
  for (const b of BAR) for (const n of b.needs) assert.ok(ids.has(n), `${b.id} needs ${n}, which is not a clause`);
});
test("the three new abilities are in the list, after the original nine", () => {
  assert.deepEqual(ABILITIES.slice(9), ["refuseTool", "permissionGate", "cardWaits"]);
});
test("a card that waits is not a box: Codex checks box 11 with cardWaits a measured no", () => {
  const p = codex({});
  assert.equal(p.abilities.cardWaits.answer, "no");
  assert.equal(p.can.cardWaits, false);
  assert.equal(checkBar(p).find((b) => b.id === "questionCard").ok, true);
  assert.equal(isSuperharness(p), true);
  assert.ok(BAR.every((b) => !b.needs.includes("abilities.cardWaits")));
});
test("both shipped adapters are superharnesses: eleven of eleven", () => {
  for (const f of [claudeCode, codex]) {
    const p = f({});
    assert.deepEqual(failedIds(p), [], p.id);
    assert.equal(checkBar(p).length, 11);
    assert.equal(isSuperharness(p), true, p.id);
  }
});
test("checkBar returns one row per box with its half, a boolean and a reason", () => {
  for (const r of checkBar(superToy())) {
    assert.equal(typeof r.ok, "boolean", r.id);
    assert.ok(["capability", "safety"].includes(r.half), r.id);
    assert.ok(typeof r.why === "string" && r.why.length > 0, r.id);
  }
  assert.deepEqual(checkBar(superToy()).map((r) => r.id), BAR.map((b) => b.id));
});
test("the toy that declares everything is a superharness, and the six-clause toy is not", () => {
  assert.equal(isSuperharness(superToy()), true);
  const six = defineHarness({ id: "x", label: "X", configDir: (h) => h, skillsDir: (h) => h, transcriptsRoot: (h) => h,
    bin: () => "x", deliverIdentity: { via: "hook-context" }, moments: { sessionStart: "S" } });
  assert.equal(isSuperharness(six), false);
  assert.deepEqual(failedIds(six), ["tools", "unattended", "helpers", "refuses", "permission", "record", "remoteControl", "questionCard"]);
});

// Each row: a change to the toy, and the one box it must fail.
const BREAKS = [
  ["computer", { bin: "toy" }],
  ["instructions", { deliverIdentity: { via: "file" } }],
  ["instructions", { deliverIdentity: { via: "pigeon" } }],
  ["instructions", { deliverIdentity: undefined }],
  ["skills", { skillsDir: () => "" }],
  ["skills", { skillsDir: undefined }],
  ["skills", { skillsDir: () => { throw new Error("boom"); } }],
  ["unattended", { startBackground: null }],
  ["refuses", { moments: { sessionStart: "Start", beforeTool: null } }],
  ["record", { isTurn: undefined }],
  ["questionCard", { questionCard: undefined }],
  ["questionCard", { questionCard: { ...superSpec().questionCard, tools: [] } }],
  ["questionCard", { questionCard: { ...superSpec().questionCard, answeredBy: "later" } }],
  ["questionCard", { questionCard: { ...superSpec().questionCard, read: "no" } }],
  ["questionCard", { questionCard: { ...superSpec().questionCard, shape: "" } }],
  ["questionCard", { questionCard: { ...superSpec().questionCard, read: () => { throw new Error("boom"); } } }],
];
test("breaking one thing fails exactly one box, and the harness is no longer a superharness", () => {
  for (const [box, over] of BREAKS) {
    const p = superToy(over);
    assert.deepEqual(failedIds(p), [box], `${box}: ${Object.keys(over)}`);
    assert.equal(isSuperharness(p), false);
  }
});
test("a place that is shared by two boxes fails both", () => {
  assert.deepEqual(failedIds(superToy({ transcriptsRoot: () => null })), ["computer", "record"]);
  assert.deepEqual(failedIds(superToy({ configDir: () => "" })), ["computer"]);
});

// Each row: a box, and the ability whose evidenced yes it needs.
const NEEDS_YES = [["tools", "mcp"], ["unattended", "backgroundSession"], ["helpers", "subagents"],
  ["refuses", "refuseTool"], ["permission", "permissionGate"], ["remoteControl", "phone"], ["questionCard", "askCard"]];
test("a box that rests on an ability needs an evidenced yes: a date, a version and an evidence sentence", () => {
  for (const [box, ability] of NEEDS_YES) {
    for (const bad of [
      undefined, { answer: "unmeasured" }, { answer: "no", measured: "2026-01-02", version: "1", evidence: "none" },
      { answer: "yes" }, { ...Y, measured: undefined }, { ...Y, measured: "last week" }, { ...Y, measured: "2026-13-45" },
      { ...Y, version: "" }, { ...Y, evidence: " " },
    ]) {
      assert.deepEqual(failedIds(withAbilities({ [ability]: bad })), [box], `${box} with ${JSON.stringify(bad)}`);
    }
    assert.deepEqual(failedIds(withAbilities({ [ability]: Y })), [], box);
  }
});
test("ten boxes is not a superharness", () => {
  for (const [box, ability] of NEEDS_YES) {
    const p = withAbilities({ [ability]: { answer: "unmeasured" } });
    assert.equal(checkBar(p).filter((b) => b.ok).length, 10, box);
    assert.equal(isSuperharness(p), false, box);
  }
});
test("checkBar never throws, whatever it is handed", () => {
  for (const junk of [null, undefined, {}, { abilities: 7, moments: "x" }, "codex"]) {
    assert.equal(checkBar(junk).length, 11);
    assert.equal(isSuperharness(junk), false);
  }
});

test("remote control: the ability key is still phone, and remoteControl mirrors it everywhere", () => {
  for (const p of [claudeCode({}), codex({}), superToy()]) {
    assert.equal(p.can.phone, true, p.id);
    assert.equal(p.can.remoteControl, true, p.id);
    assert.deepEqual(p.abilities.remoteControl, p.abilities.phone, p.id);
    assert.ok("remoteControl" in p.can);
  }
  const none = withAbilities({ phone: { answer: "unmeasured" } });
  assert.equal(none.can.phone, false);
  assert.equal(none.can.remoteControl, false);
  assert.equal(none.abilities.remoteControl.answer, "unmeasured");
});
test("an adapter may declare remoteControl instead of phone, and both keys answer", () => {
  const { phone, ...rest } = superSpec().abilities;
  const p = superToy({ abilities: { ...rest, remoteControl: Y } });
  assert.equal(p.can.phone, true);
  assert.equal(p.can.remoteControl, true);
  assert.equal(isSuperharness(p), true);
});

test("summarize says whether the harness is a superharness and which boxes are missing", () => {
  const yes = summarize(checkStatic(codex({})));
  assert.equal(yes.superharness, true);
  assert.deepEqual(yes.bar, { ok: 11, total: 11, missing: [] });
  const no = summarize(checkStatic(withAbilities({ phone: { answer: "unmeasured" }, mcp: { answer: "yes" } })));
  assert.equal(no.superharness, false);
  assert.deepEqual(no.bar, { ok: 9, total: 11, missing: ["tools", "remoteControl"] });
});
test("the static check carries one row per box after the clauses, and a missing box is not a malformed clause", () => {
  const rows = checkStatic(withAbilities({ phone: { answer: "unmeasured" } }));
  const bar = rows.filter((r) => r.level === "bar");
  assert.deepEqual(bar.map((r) => r.id), BAR.map((b) => `bar.${b.id}`));
  const s = summarize(rows);
  assert.deepEqual(s.failed, []);
  assert.equal(s.pass, true, "every clause is well formed");
  assert.equal(s.superharness, false);
});
