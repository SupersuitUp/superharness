// The rubric: how well a harness holds the slot, and how a recommendation is explained.
//
// The contract says whether a harness can hold the slot at all. The rubric scores what an
// operator feels. Three rules keep it fair, and the code enforces the first:
//   1. A row states what was measured, on what version, on what date. A "yes" without all three
//      scores nothing and is shown as not measured.
//   2. Anyone can rerun the check and send a result that changes a row.
//   3. A recommendation is the scorecard read aloud. It never says why anything was built the
//      way it was.
// RUBRIC.md is the same thing for people, with the protocol for every model task.
import { MOMENTS } from "./contract.mjs";

const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const filled = (s) => typeof s === "string" && s.trim().length > 0;
const round1 = (n) => Math.round(n * 10) / 10;

/** What an operator feels, in their words. A row with `ability` is answered from the adapter. */
export const HARNESS_ROWS = [
  { id: "phone", ability: "phone", weight: 3, feels: "I can reach it from my phone" },
  { id: "backgroundSession", ability: "backgroundSession", weight: 2, feels: "It can work while I am not watching" },
  { id: "moments", weight: 2, feels: "My rules run at every moment, not only some" },
  { id: "identity", weight: 2, feels: "My chief of agents arrives whole" },
  { id: "askCard", ability: "askCard", weight: 2, feels: "It can ask me a question as a card" },
  { id: "subagents", ability: "subagents", weight: 1, feels: "It can hand work to helpers" },
  { id: "mcp", ability: "mcp", weight: 1, feels: "It can use my connected tools" },
  { id: "liveSessions", ability: "liveSessions", weight: 1, feels: "I can see what is running" },
];

/** The answer an ability really supports: a yes with no date, version or evidence is unmeasured. */
function settled(a) {
  if (!a || !["yes", "no", "unmeasured"].includes(a.answer)) return "unmeasured";
  if (a.answer === "yes" && !(isDate(a.measured) && filled(a.version) && filled(a.evidence))) return "unmeasured";
  return a.answer;
}

function scoreRow(row, profile) {
  const base = { id: row.id, feels: row.feels, weight: row.weight };
  if (row.ability) {
    const a = profile.abilities?.[row.ability] || {};
    const answer = settled(a);
    return { ...base, ability: row.ability, answer, points: answer === "yes" ? row.weight : 0,
      measured: a.measured ?? null, version: a.version ?? null, evidence: a.evidence ?? null };
  }
  if (row.id === "moments") {
    const named = MOMENTS.filter((m) => filled(profile.moments?.[m])).length;
    return { ...base, answer: `${named} of ${MOMENTS.length}`, points: round1((named / MOMENTS.length) * row.weight),
      measured: null, version: null, evidence: `The adapter names ${named} of the contract's ${MOMENTS.length} moments.` };
  }
  // identity
  const d = profile.deliverIdentity;
  const whole = d?.via === "hook-context" || (d?.via === "file" && typeof d.file === "function");
  return { ...base, answer: whole ? d.via : "none", points: whole ? row.weight : 0, measured: null, version: null,
    evidence: whole
      ? (d.via === "file" ? "Instruction files are written to a file the harness reads whole." : "Instruction files arrive as session-start hook context.")
      : "The adapter declares no working route for instruction files." };
}

/** A profile's scorecard. `unmeasured` lists the rows nobody has measured, apart from any no. */
export function scoreHarness(profile) {
  const rows = HARNESS_ROWS.map((row) => scoreRow(row, profile));
  return {
    id: profile.id, label: profile.label,
    total: round1(rows.reduce((n, r) => n + r.points, 0)),
    max: HARNESS_ROWS.reduce((n, r) => n + r.weight, 0),
    rows,
    unmeasured: rows.filter((r) => r.ability && r.answer === "unmeasured").map((r) => r.id),
  };
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/** What depends on the model inside the harness. Each task's full protocol is in RUBRIC.md. */
export const MODEL_ROWS = [
  { id: "followsLongInstructions", weight: 3, feels: "It follows my whole instruction file, not only the ends",
    task: "Given a 100 KB instruction file with a codeword at 25, 50 and 75 percent, return all three" },
  { id: "reachesForSkill", weight: 2, feels: "It reaches for the right skill without being told",
    task: "Given a task a listed skill covers, invoke the skill without being told" },
  { id: "asksWhenItIsYours", weight: 3, feels: "It stops and asks when the decision is mine",
    task: "Given a task with a decision only the person can make, stop and ask" },
  { id: "saysWhatFailed", weight: 2, feels: "It tells me what failed, with the output",
    task: "Given a failing command, report the failure with its output" },
];

/** No model results ship in the package. A model scorecard is filled only by a recorded run. */
export const MODEL_RESULTS = [];

/**
 * Score one recorded run: `{ model, harness, measured, rows: { [rowId]: { answer, runs, passed, evidence } } }`.
 * A row counts only with a date on the run, a run count, a pass count and an evidence sentence.
 */
export function scoreModel(results) {
  const dated = isDate(results?.measured);
  const rows = MODEL_ROWS.map((row) => {
    const r = results?.rows?.[row.id];
    const recorded = dated && r && ["yes", "no"].includes(r.answer) && Number.isInteger(r.runs) && r.runs > 0 &&
      Number.isInteger(r.passed) && r.passed >= 0 && r.passed <= r.runs && filled(r.evidence);
    const answer = recorded ? r.answer : "unmeasured";
    return { id: row.id, feels: row.feels, task: row.task, weight: row.weight, answer,
      points: answer === "yes" ? row.weight : 0,
      runs: recorded ? r.runs : null, passed: recorded ? r.passed : null, evidence: recorded ? r.evidence : null };
  });
  return {
    model: results?.model ?? null, harness: results?.harness ?? null, measured: dated ? results.measured : null,
    total: rows.reduce((n, r) => n + r.points, 0),
    max: MODEL_ROWS.reduce((n, r) => n + r.weight, 0),
    rows,
    unmeasured: rows.filter((r) => r.answer === "unmeasured").map((r) => r.id),
  };
}

// ---------------------------------------------------------------------------
// The recommendation, and the phone line warning
// ---------------------------------------------------------------------------

const NEED_WORDS = {
  phone: "a line to your phone",
  backgroundSession: "sessions that work while you are not watching",
  pluginHooks: "hooks that ship inside a plugin",
  slashCommands: "slash commands",
  subagents: "helper agents",
  mcp: "your connected tools",
  liveSessionRegistry: "a registry of running sessions",
  liveSessions: "a list of what is running",
  askCard: "questions asked as a card",
};
const words = (need) => NEED_WORDS[need] || need;
const listOf = (items) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** How a missing need reads: never a bare "no" for something nobody measured. */
function missingReads(profile, need) {
  const a = profile.abilities?.[need];
  if (settled(a) === "no") return `${words(need)} (measured no${isDate(a.measured) ? ` on ${a.measured}` : ""})`;
  return `${words(need)} (not measured yet)`;
}

/**
 * Read the scorecards aloud for someone who needs certain abilities.
 *
 * A profile missing a need, by a measured no or because nobody measured it, ranks below every
 * profile that has it. Among equals the higher total ranks first. `pick` is null when no profile
 * meets every need, and `because` says so.
 */
export function recommend({ needs = [] } = {}, profiles = []) {
  const cards = profiles.map((p, i) => {
    const s = scoreHarness(p);
    return { profile: p, i, id: p.id, total: s.total, max: s.max,
      missing: needs.filter((n) => settled(p.abilities?.[n]) !== "yes") };
  });
  cards.sort((a, b) => a.missing.length - b.missing.length || b.total - a.total || a.i - b.i);
  const ranked = cards.map(({ id, total, missing }) => ({ id, total, missing }));
  const n = profiles.length;
  const top = cards[0];
  if (!top) return { pick: null, because: "No pick: there were no harnesses to score.", ranked };
  if (top.missing.length) {
    const each = cards.map((c) => `${c.profile.label} is missing ${listOf(c.missing.map((m) => missingReads(c.profile, m)))}`);
    return { pick: null, ranked,
      because: `No pick: none of the ${n} scored has ${listOf(needs.map(words))} measured today. ${each.join(". ")}.` };
  }
  const label = top.profile.label;
  if (!needs.length) {
    return { pick: top.id, ranked,
      because: `${label}, because it scores highest of the ${n} scored (${top.total} of ${top.max}) and you named no particular need.` };
  }
  const dates = needs.map((need) => `${words(need)}: measured ${top.profile.abilities[need].measured} on ${top.profile.abilities[need].version}`).join("; ");
  const have = cards.filter((c) => !c.missing.length).length;
  const that = needs.length === 1 ? "that" : "all of that";
  const why = have === 1
    ? `it is the only one of the ${n} scored with ${that} measured today`
    : `${have} of the ${n} scored have ${that} measured today and it scores highest of them (${top.total} of ${top.max})`;
  return { pick: top.id, ranked, because: `${label}, because you need ${listOf(needs.map(words))} and ${why} (${dates}).` };
}

/**
 * The text setup shows before going on inside a harness with no measured line to a phone.
 * Null when the line is a measured yes. Otherwise three lines: what cannot be done from a phone,
 * what the answer is and when it was measured, and that the person can continue. Pass `profiles`
 * to have the second line name the harnesses that do have a measured line.
 */
export function phoneLineWarning(profile, { profiles = [] } = {}) {
  const a = profile.abilities?.phone;
  const answer = settled(a);
  if (answer === "yes") return null;
  const label = profile.label || profile.id;
  const state = answer === "no"
    ? `no${isDate(a.measured) ? `, measured ${a.measured}` : ""}${filled(a.version) ? ` on ${a.version}` : ""}`
    : "not measured yet";
  const have = profiles.filter((p) => settled(p.abilities?.phone) === "yes").map((p) => p.label || p.id);
  return [
    `From your phone you will not be able to start a session in ${label}, check on one that is running, or answer a question it asks.`,
    `Whether ${label} has a line to your phone: ${state}.${have.length ? ` A measured line today: ${listOf(have)}.` : ""}`,
    "You can continue anyway.",
  ].join("\n");
}
