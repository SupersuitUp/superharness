import { test } from "node:test";
import assert from "node:assert/strict";
import claudeCode from "../src/adapters/claude-code.mjs";
import codex from "../src/adapters/codex.mjs";
import { defineHarness } from "../src/define.mjs";
import { ABILITIES } from "../src/contract.mjs";
import {
  HARNESS_ROWS, MODEL_ROWS, MODEL_RESULTS, scoreHarness, scoreModel, recommend, phoneLineWarning,
} from "../src/rubric.mjs";

test("a measured yes scores its weight; unmeasured scores nothing and is listed apart from no", () => {
  const cc = scoreHarness(claudeCode({})), cx = scoreHarness(codex({}));
  assert.equal(cc.rows.find((r) => r.id === "phone").points, 3);
  assert.equal(cx.rows.find((r) => r.id === "phone").points, 0);
  assert.ok(cx.unmeasured.includes("phone"));
  assert.ok(cc.total > cx.total);
  assert.ok(cc.total <= cc.max);
});
test("every scored row carries its date, version and evidence, or scores zero", () => {
  for (const s of [scoreHarness(claudeCode({})), scoreHarness(codex({}))])
    for (const r of s.rows.filter((r) => r.ability && r.points > 0))
      assert.ok(r.measured && r.version && r.evidence, `${s.id}.${r.id}`);
});
test("recommend reads the scorecard aloud and names the need that decided it", () => {
  const r = recommend({ needs: ["phone"] }, [claudeCode({}), codex({})]);
  assert.equal(r.pick, "claude-code");
  assert.match(r.because, /phone/);
  assert.match(r.because, /\d{4}-\d{2}-\d{2}/);
  assert.ok(!/because (they|it) (want|chose|decided)/i.test(r.because));
});
test("no pick when nothing meets the need, and it says so", () => {
  const r = recommend({ needs: ["askCard", "interrupt-nonexistent"] }, [codex({})]);
  assert.equal(r.pick, null);
});
test("the phone line warning is null for a measured yes and three lines otherwise", () => {
  assert.equal(phoneLineWarning(claudeCode({})), null);
  const w = phoneLineWarning(codex({}));
  assert.equal(w.split("\n").length, 3);
  assert.match(w, /not measured yet/);
});
test("the package ships no model results: a model scorecard is earned by a run", () => {
  assert.deepEqual(MODEL_RESULTS, []);
  const s = scoreModel({ model: "m", harness: "claude-code", measured: "2026-10-13", rows: {} });
  assert.equal(s.total, 0);
  assert.equal(s.unmeasured.length, MODEL_ROWS.length);
});

// ---------------------------------------------------------------------------
// The rows, and the rules that keep them fair
// ---------------------------------------------------------------------------

const toy = (over = {}) => defineHarness({ id: "toy", label: "Toy", configDir: (h) => h, skillsDir: (h) => h,
  transcriptsRoot: (h) => h, bin: () => "toy", deliverIdentity: { via: "hook-context" },
  moments: { sessionStart: "S" }, ...over });
const measuredYes = { answer: "yes", measured: "2026-01-02", version: "1.0.0", evidence: "seen" };

test("the rows and weights are the ones the rubric document states", () => {
  assert.deepEqual(HARNESS_ROWS.map((r) => [r.id, r.weight]), [["phone", 3], ["backgroundSession", 2],
    ["moments", 2], ["identity", 2], ["askCard", 2], ["subagents", 1], ["mcp", 1], ["liveSessions", 1]]);
  assert.deepEqual(MODEL_ROWS.map((r) => [r.id, r.weight]), [["followsLongInstructions", 3],
    ["reachesForSkill", 2], ["asksWhenItIsYours", 3], ["saysWhatFailed", 2]]);
  for (const r of [...HARNESS_ROWS, ...MODEL_ROWS]) assert.ok(r.feels.length > 10 && !r.feels.includes("—"), r.id);
  for (const r of HARNESS_ROWS.filter((r) => r.ability)) assert.ok(ABILITIES.includes(r.ability), r.id);
  for (const r of MODEL_ROWS) assert.ok(r.task.length > 20, r.id);
});
test("the max is the sum of the weights, and the total is the sum of the points", () => {
  for (const p of [claudeCode({}), codex({}), toy()]) {
    const s = scoreHarness(p);
    assert.equal(s.max, 14);
    assert.equal(s.total, Math.round(s.rows.reduce((n, r) => n + r.points, 0) * 10) / 10);
    assert.equal(s.id, p.id);
    assert.equal(s.label, p.label);
  }
});
test("the moments row is the share of the fourteen moments the harness names, scaled to its weight", () => {
  assert.equal(scoreHarness(claudeCode({})).rows.find((r) => r.id === "moments").points, 1.6); // 11 of 14
  assert.equal(scoreHarness(codex({})).rows.find((r) => r.id === "moments").points, 1.7);      // 12 of 14
  assert.equal(scoreHarness(toy()).rows.find((r) => r.id === "moments").points, 0.1);          // 1 of 14
  assert.match(scoreHarness(codex({})).rows.find((r) => r.id === "moments").answer, /12 of 14/);
});
test("the identity row scores for a hook route or a file route with a getter, and nothing else", () => {
  const pts = (deliverIdentity) => scoreHarness(toy({ deliverIdentity })).rows.find((r) => r.id === "identity").points;
  assert.equal(pts({ via: "hook-context" }), 2);
  assert.equal(pts({ via: "file", file: (h) => h + "/A.md" }), 2);
  assert.equal(pts({ via: "file" }), 0);
  assert.equal(pts(undefined), 0);
});
test("a measured no scores nothing and is not listed as unmeasured", () => {
  const s = scoreHarness(toy({ abilities: { phone: { answer: "no", measured: "2026-01-02", version: "1", evidence: "none found" } } }));
  assert.equal(s.rows.find((r) => r.id === "phone").points, 0);
  assert.ok(!s.unmeasured.includes("phone"));
  assert.ok(s.unmeasured.includes("askCard"));
});
test("a yes with no date, version or evidence scores zero and is listed as unmeasured", () => {
  const s = scoreHarness(toy({ abilities: { phone: { answer: "yes" }, mcp: measuredYes } }));
  assert.equal(s.rows.find((r) => r.id === "phone").points, 0);
  assert.equal(s.rows.find((r) => r.id === "phone").answer, "unmeasured");
  assert.ok(s.unmeasured.includes("phone"));
  assert.equal(s.rows.find((r) => r.id === "mcp").points, 1);
});

test("recommend ranks a profile that has the need above one that does not, whatever the totals", () => {
  const low = toy({ id: "low", label: "Low", abilities: { phone: measuredYes } });
  const high = defineHarness({ ...codex({}), id: "high", label: "High" });
  const r = recommend({ needs: ["phone"] }, [high, low]);
  assert.ok(scoreHarness(high).total > scoreHarness(low).total);
  assert.equal(r.pick, "low");
  assert.deepEqual(r.ranked.map((x) => x.id), ["low", "high"]);
  assert.deepEqual(r.ranked[1].missing, ["phone"]);
});
test("recommend with no needs picks the highest total and says that is why", () => {
  const r = recommend({ needs: [] }, [codex({}), claudeCode({})]);
  assert.equal(r.pick, "claude-code");
  assert.match(r.because, /13\.6 of 14/);
});
test("recommend with no pick names what each profile is missing, and tells unmeasured from a measured no", () => {
  const r = recommend({ needs: ["phone", "liveSessionRegistry"] }, [codex({})]);
  assert.equal(r.pick, null);
  assert.match(r.because, /No pick/);
  assert.match(r.because, /not measured yet/);
  assert.match(r.because, /measured no/);
  assert.deepEqual(r.ranked[0].missing, ["phone", "liveSessionRegistry"]);
});
test("a recommendation never states a motive, for any combination of needs", () => {
  const profiles = [claudeCode({}), codex({})];
  for (const a of ABILITIES) for (const b of ABILITIES) {
    const { because } = recommend({ needs: a === b ? [a] : [a, b] }, profiles);
    assert.ok(!/\b(want|wants|wanted|chose|decided|refus|intend|plan to|strategy)\b/i.test(because), because);
    assert.ok(!because.includes("—"), because);
  }
});

test("the phone line warning says a measured no with its date, and can name who has the line", () => {
  const p = toy({ abilities: { phone: { answer: "no", measured: "2026-03-04", version: "2.0", evidence: "no route" } } });
  const w = phoneLineWarning(p);
  assert.equal(w.split("\n").length, 3);
  assert.match(w, /Toy/);
  assert.match(w, /no, measured 2026-03-04/);
  assert.match(w.split("\n")[2], /continue/);
  const named = phoneLineWarning(codex({}), { profiles: [claudeCode({}), codex({})] });
  assert.equal(named.split("\n").length, 3);
  assert.match(named, /Claude Code/);
});

test("a model row scores only for a recorded run: runs, passes, evidence and a date", () => {
  const base = { model: "m", harness: "claude-code", measured: "2026-10-13" };
  const good = { answer: "yes", runs: 5, passed: 5, evidence: "all three codewords returned in 5 of 5 runs" };
  assert.equal(scoreModel({ ...base, rows: { followsLongInstructions: good } }).total, 3);
  assert.equal(scoreModel({ ...base, rows: { followsLongInstructions: { answer: "yes" } } }).total, 0);
  assert.equal(scoreModel({ ...base, rows: { followsLongInstructions: { ...good, evidence: "" } } }).total, 0);
  assert.equal(scoreModel({ ...base, measured: undefined, rows: { followsLongInstructions: good } }).total, 0);
  const no = scoreModel({ ...base, rows: { saysWhatFailed: { answer: "no", runs: 5, passed: 1, evidence: "reported success in 4 of 5" } } });
  assert.equal(no.total, 0);
  assert.ok(!no.unmeasured.includes("saysWhatFailed"));
  assert.equal(no.max, 10);
});
