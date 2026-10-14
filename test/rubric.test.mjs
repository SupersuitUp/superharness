import { test } from "node:test";
import assert from "node:assert/strict";
import claudeCode from "../src/adapters/claude-code.mjs";
import codex from "../src/adapters/codex.mjs";
import { defineHarness } from "../src/define.mjs";
import { ABILITIES } from "../src/contract.mjs";
import {
  QUALITIES, MOLDABILITY, STEERABILITY, HARNESS_ROWS, MODEL_ROWS, MODEL_RESULTS, scoreHarness, scoreModel, recommend, remoteControlWarning, phoneLineWarning,
} from "../src/rubric.mjs";
import { superToy, withAbilities, Y } from "./fixtures.mjs";

const noRemote = () => withAbilities({ phone: { answer: "unmeasured" } });

test("a measured yes scores its weight; unmeasured scores nothing and is listed apart from no", () => {
  const cc = scoreHarness(claudeCode({})), cx = scoreHarness(codex({})), t = scoreHarness(noRemote());
  assert.equal(cc.rows.find((r) => r.id === "phone").points, 3);
  assert.equal(cx.rows.find((r) => r.id === "phone").points, 3);
  assert.equal(t.rows.find((r) => r.id === "phone").points, 0);
  assert.ok(t.unmeasured.includes("phone"));
  assert.deepEqual(cx.unmeasured, []);
  assert.ok(cc.total <= cc.max);
});
test("a question that waits: Codex scores nothing on the row, as a measured no, and is still a superharness", () => {
  const cx = scoreHarness(codex({}));
  const row = cx.rows.find((r) => r.id === "cardWaits");
  assert.equal(row.points, 0);
  assert.equal(row.answer, "no");
  assert.ok(!cx.unmeasured.includes("cardWaits"));
  assert.equal(cx.superharness, true);
  assert.ok(cx.total < cx.max - 2 + 0.01);
  assert.match(row.evidence, /28969/);
});
test("a profile that says its cards wait without evidence scores nothing on the row", () => {
  const bare = scoreHarness(withAbilities({ cardWaits: { answer: "yes" } }));
  assert.equal(bare.rows.find((r) => r.id === "cardWaits").points, 0);
  assert.equal(bare.rows.find((r) => r.id === "cardWaits").answer, "unmeasured");
  assert.ok(bare.unmeasured.includes("cardWaits"));
  for (const partial of [{ ...Y, measured: undefined }, { ...Y, version: "" }, { ...Y, evidence: "" }])
    assert.equal(scoreHarness(withAbilities({ cardWaits: partial })).rows.find((r) => r.id === "cardWaits").points, 0);
  assert.equal(scoreHarness(withAbilities({ cardWaits: Y })).rows.find((r) => r.id === "cardWaits").points, 2);
});
test("moldability and steerability are each defined in one sentence, and every row belongs to one of the three qualities", () => {
  assert.equal(MOLDABILITY, "Moldability is how far your own context reshapes a harness before you say anything: what it calls itself, how it behaves, and what it does unprompted.");
  assert.equal(STEERABILITY, "Steerability is how well you can turn a harness while it is working, without stopping it.");
  assert.deepEqual(Object.keys(QUALITIES), ["moldability", "steerability", "reach"]);
  assert.equal(QUALITIES.moldability, MOLDABILITY);
  assert.equal(QUALITIES.steerability, STEERABILITY);
  for (const r of HARNESS_ROWS) assert.ok(r.quality in QUALITIES, r.id);
});
test("a scorecard carries a subtotal per quality, and the subtotals add up to the total", () => {
  for (const p of [claudeCode({}), codex({}), toy(), superToy(), noRemote()]) {
    const s = scoreHarness(p);
    assert.deepEqual(Object.keys(s.qualities), ["moldability", "steerability", "reach"]);
    assert.equal(s.qualities.moldability.max, 9);
    assert.equal(s.qualities.steerability.max, 2);
    assert.equal(s.qualities.reach.max, 12);
    assert.equal(s.qualities.moldability.max + s.qualities.steerability.max + s.qualities.reach.max, s.max);
    assert.equal(Math.round((s.qualities.moldability.total + s.qualities.steerability.total + s.qualities.reach.total) * 10) / 10, s.total, p.id);
    for (const q of Object.keys(QUALITIES))
      assert.equal(s.qualities[q].total, Math.round(s.rows.filter((r) => r.quality === q).reduce((n, r) => n + r.points, 0) * 10) / 10, `${p.id} ${q}`);
  }
});
test("the two shipped scorecards, by quality", () => {
  const cc = scoreHarness(claudeCode({})), cx = scoreHarness(codex({}));
  assert.deepEqual(cc.qualities, { moldability: { total: 6.6, max: 9 }, steerability: { total: 2, max: 2 }, reach: { total: 12, max: 12 } });
  assert.deepEqual(cx.qualities, { moldability: { total: 6.7, max: 9 }, steerability: { total: 0, max: 2 }, reach: { total: 10, max: 12 } });
  assert.equal(cc.total, 20.6);
  assert.equal(cx.total, 16.7);
});
test("steerability: Codex scores nothing on either row; Claude Code scores one and has the other unmeasured", () => {
  const row = (p, id) => scoreHarness(p).rows.find((r) => r.id === id);
  for (const id of ["followsStanding", "steersMidTask"]) {
    assert.equal(row(codex({}), id).points, 0, id);
    assert.equal(row(codex({}), id).answer, "no", id);
    assert.ok(!scoreHarness(codex({})).unmeasured.includes(id), id);
  }
  assert.equal(row(claudeCode({}), "steersMidTask").points, 2);
  assert.equal(row(claudeCode({}), "followsStanding").points, 0);
  assert.equal(row(claudeCode({}), "followsStanding").answer, "unmeasured");
  assert.deepEqual(scoreHarness(claudeCode({})).unmeasured, ["followsStanding"]);
});
test("identity and the starting instructions: both shipped harnesses score both rows", () => {
  for (const p of [claudeCode({}), codex({})]) {
    const s = scoreHarness(p);
    assert.equal(s.rows.find((r) => r.id === "takesIdentity").points, 2, p.id);
    assert.equal(s.rows.find((r) => r.id === "extendsSystemPrompt").points, 1, p.id);
  }
});
test("every ability row obeys the evidence rule: a bare or partial yes scores nothing, an evidenced yes scores the weight", () => {
  for (const r of HARNESS_ROWS.filter((r) => r.ability)) {
    const pts = (a) => scoreHarness(withAbilities({ [r.ability]: a })).rows.find((x) => x.id === r.id);
    assert.equal(pts({ answer: "yes" }).points, 0, r.id);
    assert.equal(pts({ answer: "yes" }).answer, "unmeasured", r.id);
    for (const partial of [{ ...Y, measured: undefined }, { ...Y, version: "" }, { ...Y, evidence: "" }]) assert.equal(pts(partial).points, 0, r.id);
    assert.equal(pts(Y).points, r.weight, r.id);
    assert.equal(pts({ answer: "no", measured: "2026-01-02", version: "1", evidence: "seen not to" }).answer, "no", r.id);
  }
});
test("a scorecard starts with the pass line: whether the harness is a superharness, and which boxes it misses", () => {
  for (const p of [claudeCode({}), codex({}), superToy()]) {
    const s = scoreHarness(p);
    assert.equal(s.superharness, true, p.id);
    assert.deepEqual(s.bar, { ok: 11, total: 11, missing: [] });
  }
  const s = scoreHarness(noRemote());
  assert.equal(s.superharness, false);
  assert.deepEqual(s.bar, { ok: 10, total: 11, missing: ["remoteControl"] });
});
test("every scored row carries its date, version and evidence, or scores zero", () => {
  for (const s of [scoreHarness(claudeCode({})), scoreHarness(codex({}))])
    for (const r of s.rows.filter((r) => r.ability && r.points > 0))
      assert.ok(r.measured && r.version && r.evidence, `${s.id}.${r.id}`);
});
test("recommend reads the scorecard aloud and names the need that decided it", () => {
  const r = recommend({ needs: ["liveSessionRegistry"] }, [claudeCode({}), codex({})]);
  assert.equal(r.pick, "claude-code");
  assert.match(r.because, /a registry of running sessions/);
  assert.match(r.because, /the only one of the 2 superharnesses scored/);
  assert.match(r.because, /\d{4}-\d{2}-\d{2}/);
  assert.ok(!/because (they|it) (want|chose|decided)/i.test(r.because));
});
test("a need for remote control is said as remote control, under either key", () => {
  for (const need of ["phone", "remoteControl"]) {
    const r = recommend({ needs: [need] }, [claudeCode({}), codex({})]);
    assert.equal(r.pick, "claude-code", "both have it, and Claude Code scores higher");
    assert.match(r.because, /^Claude Code, because you need remote control and 2 of the 2 superharnesses scored have that measured today/);
    assert.ok(!/phone line|line to your phone/.test(r.because));
  }
});
test("only a superharness is ever picked, whatever the totals and whatever the need", () => {
  const nearly = defineHarness({ ...codex({}), id: "nearly", label: "Nearly", isTurn: undefined });
  assert.equal(scoreHarness(nearly).total, scoreHarness(codex({})).total);
  const r = recommend({ needs: [] }, [nearly, claudeCode({})]);
  assert.equal(r.pick, "claude-code");
  assert.deepEqual(r.ranked.map((x) => [x.id, x.superharness]), [["claude-code", true], ["nearly", false]]);
  assert.match(r.because, /it is the only superharness scored/);
  const none = recommend({ needs: ["mcp"] }, [nearly, toy()]);
  assert.equal(none.pick, null);
  assert.match(none.because, /^No pick: none of the 2 scored is a superharness\. Nearly is missing 1 of the 11 boxes \(record\)\. Toy is missing 8 of the 11 boxes/);
});
test("no pick when nothing meets the need, and it says so", () => {
  const r = recommend({ needs: ["askCard", "interrupt-nonexistent"] }, [codex({})]);
  assert.equal(r.pick, null);
});
test("the remote control warning is null for a measured yes and three lines otherwise", () => {
  assert.equal(remoteControlWarning(claudeCode({})), null);
  assert.equal(remoteControlWarning(codex({})), null);
  const w = remoteControlWarning(noRemote());
  assert.equal(w.split("\n").length, 3);
  assert.match(w, /not measured yet/);
  for (const l of w.split("\n").slice(0, 2)) assert.match(l, /remote control/i);
  assert.ok(!/phone line|line to your phone/.test(w));
});
test("phoneLineWarning is kept as another name for the same function", () => {
  assert.equal(phoneLineWarning, remoteControlWarning);
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
  assert.deepEqual(HARNESS_ROWS.map((r) => [r.id, r.weight, r.quality]), [
    ["phone", 3, "reach"], ["backgroundSession", 2, "reach"], ["askCard", 2, "reach"], ["cardWaits", 2, "reach"],
    ["subagents", 1, "reach"], ["mcp", 1, "reach"], ["liveSessions", 1, "reach"],
    ["moments", 2, "moldability"], ["identity", 2, "moldability"], ["takesIdentity", 2, "moldability"],
    ["followsStanding", 2, "moldability"], ["steersMidTask", 2, "steerability"], ["extendsSystemPrompt", 1, "moldability"]]);
  const feels = Object.fromEntries(HARNESS_ROWS.map((r) => [r.id, r.feels]));
  assert.equal(feels.followsStanding, "It follows my standing instructions without being reminded");
  assert.equal(feels.steersMidTask, "I can redirect it while it is working, without stopping it");
  assert.equal(feels.takesIdentity, "It becomes who my files say it is: a name, a voice, rules of its own");
  assert.equal(feels.extendsSystemPrompt, "I can add to or replace the instructions it starts from, beyond a file in my folder");
  assert.equal(HARNESS_ROWS.find((r) => r.id === "cardWaits").feels, "A question waits for me as long as it takes");
  assert.deepEqual(MODEL_ROWS.map((r) => [r.id, r.weight]), [["followsLongInstructions", 3],
    ["reachesForSkill", 2], ["asksWhenItIsYours", 3], ["saysWhatFailed", 2]]);
  for (const r of [...HARNESS_ROWS, ...MODEL_ROWS]) assert.ok(r.feels.length > 10 && !r.feels.includes("—"), r.id);
  for (const r of HARNESS_ROWS.filter((r) => r.ability)) assert.ok(ABILITIES.includes(r.ability), r.id);
  for (const r of MODEL_ROWS) assert.ok(r.task.length > 20, r.id);
});
test("the max is the sum of the weights, and the total is the sum of the points", () => {
  for (const p of [claudeCode({}), codex({}), toy(), superToy()]) {
    const s = scoreHarness(p);
    assert.equal(s.max, 23);
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

test("recommend ranks a superharness that has the need above one that does not, whatever the totals", () => {
  const low = superToy({ id: "low", label: "Low", abilities: { ...superToy().abilities, liveSessionRegistry: Y } });
  const high = defineHarness({ ...codex({}), id: "high", label: "High" });
  const r = recommend({ needs: ["liveSessionRegistry"] }, [high, low]);
  assert.ok(scoreHarness(high).total > scoreHarness(low).total);
  assert.equal(r.pick, "low");
  assert.deepEqual(r.ranked.map((x) => x.id), ["low", "high"]);
  assert.deepEqual(r.ranked[1].missing, ["liveSessionRegistry"]);
});
test("recommend with no needs picks the highest total among superharnesses and says that is why", () => {
  const r = recommend({ needs: [] }, [codex({}), claudeCode({})]);
  assert.equal(r.pick, "claude-code");
  assert.match(r.because, /^Claude Code, because it scores highest of the 2 superharnesses scored \(20\.6 of 23\)/);
  assert.equal(recommend({ needs: ["cardWaits"] }, [codex({}), claudeCode({})]).pick, "claude-code");
  assert.match(recommend({ needs: ["cardWaits"] }, [codex({})]).because, /a question card that waits for you \(measured no on 2026-10-13\)/);
});
test("recommend with no pick names what each superharness is missing, and tells unmeasured from a measured no", () => {
  const r = recommend({ needs: ["pluginHooks", "liveSessionRegistry"] }, [codex({})]);
  assert.equal(r.pick, null);
  assert.match(r.because, /^No pick: the only superharness scored does not have/);
  assert.match(r.because, /not measured yet/);
  assert.match(r.because, /measured no/);
  assert.deepEqual(r.ranked[0].missing, ["pluginHooks", "liveSessionRegistry"]);
});
test("a recommendation never states a motive, for any combination of needs", () => {
  const profiles = [claudeCode({}), codex({})];
  for (const a of ABILITIES) for (const b of ABILITIES) {
    const { because } = recommend({ needs: a === b ? [a] : [a, b] }, profiles);
    assert.ok(!/\b(want|wants|wanted|chose|decided|refus|intend|plan to|strategy)\b/i.test(because), because);
    assert.ok(!because.includes("—"), because);
  }
});

test("the remote control warning says a measured no with its date, and can name who has it", () => {
  const p = toy({ abilities: { phone: { answer: "no", measured: "2026-03-04", version: "2.0", evidence: "no route" } } });
  const w = remoteControlWarning(p);
  assert.equal(w.split("\n").length, 3);
  assert.match(w, /Toy/);
  assert.match(w, /Whether Toy has remote control: no, measured 2026-03-04 on 2\.0\./);
  assert.match(w.split("\n")[2], /continue/);
  const named = remoteControlWarning(toy(), { profiles: [claudeCode({}), codex({}), toy()] });
  assert.equal(named.split("\n").length, 3);
  assert.match(named.split("\n")[1], /Remote control is measured today for Claude Code and Codex\.$/);
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

// --- standing: what we say about a harness, read off the scorecard and never hand-set ---
test("standing: a superharness with no measured shortfall is strongly recommended; one with any is supported", async () => {
  const { standing, STANDINGS } = await import("../src/rubric.mjs");
  assert.deepEqual(Object.keys(STANDINGS), ["recommended", "supported", "below"]);
  const cc = standing(claudeCode({})), cx = standing(codex({}));
  assert.equal(cc.id, "recommended");
  assert.equal(cc.says, "strongly recommended");
  assert.deepEqual(cc.shortfalls, []);
  assert.deepEqual(cc.unmeasured, ["followsStanding"], "an unmeasured row is named, and is not a shortfall");
  assert.equal(cx.id, "supported");
  assert.equal(cx.says, "supported");
  assert.deepEqual(cx.shortfalls.sort(), ["cardWaits", "followsStanding", "steersMidTask"]);
});
test("standing: a harness below the bar has no standing above it, whatever its scorecard says", async () => {
  const { standing } = await import("../src/rubric.mjs");
  const s = standing(noRemote());
  assert.equal(s.id, "below");
  assert.equal(s.says, "not a superharness");
  assert.ok(s.missing.includes("remoteControl"));
});
test("standing: one measured no moves a recommended harness to supported", async () => {
  const { standing } = await import("../src/rubric.mjs");
  const p = claudeCode({});
  const worse = { ...p, abilities: { ...p.abilities, followsStanding: { answer: "no", measured: "2026-10-14", version: "x", evidence: "ran the three-condition protocol" } } };
  assert.equal(standing(worse).id, "supported");
  assert.deepEqual(standing(worse).shortfalls, ["followsStanding"]);
});
