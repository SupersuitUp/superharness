// The rubric: how superharnesses compare, and how a recommendation is explained.
//
// The bar is the pass line: eleven boxes, and a harness that checks all of them is a
// superharness. The rubric is for comparing superharnesses on what an operator feels, within the
// bar and beyond it. Three rules keep it fair, and the code enforces the first:
//   1. A row states what was measured, on what version, on what date. A "yes" without all three
//      scores nothing and is shown as not measured.
//   2. Anyone can rerun the check and send a result that changes a row.
//   3. A recommendation is the scorecard read aloud. It never says why anything was built the
//      way it was.
// RUBRIC.md is the same thing for people, with the protocol for every model task.
import { BAR, checkBar } from "./bar.mjs";
import { MOMENTS } from "./contract.mjs";

const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const filled = (s) => typeof s === "string" && s.trim().length > 0;
const round1 = (n) => Math.round(n * 10) / 10;

export const MOLDABILITY = "Moldability is how far your own context reshapes a harness before you say anything: what it calls itself, how it behaves, and what it does unprompted.";
export const STEERABILITY = "Steerability is how well you can turn a harness while it is working, without stopping it.";

/** The three qualities a row can belong to. Every row has exactly one. */
export const QUALITIES = {
  moldability: MOLDABILITY,
  steerability: STEERABILITY,
  reach: "Reach is where and how a harness can work for you: from your phone, while you are away, through cards, helpers and connected tools.",
};

/** What an operator feels, in their words. A row with `ability` is answered from the adapter. */
export const HARNESS_ROWS = [
  { id: "phone", ability: "phone", quality: "reach", weight: 3, feels: "I can reach it by remote control from my phone" },
  { id: "backgroundSession", ability: "backgroundSession", quality: "reach", weight: 2, feels: "It can work while I am not watching" },
  { id: "askCard", ability: "askCard", quality: "reach", weight: 2, feels: "It can ask me a question as a card" },
  { id: "cardWaits", ability: "cardWaits", quality: "reach", weight: 2, feels: "A question waits for me as long as it takes" },
  { id: "subagents", ability: "subagents", quality: "reach", weight: 1, feels: "It can hand work to helpers" },
  { id: "mcp", ability: "mcp", quality: "reach", weight: 1, feels: "It can use my connected tools" },
  { id: "liveSessions", ability: "liveSessions", quality: "reach", weight: 1, feels: "I can see what is running" },
  { id: "moments", quality: "moldability", weight: 2, feels: "My rules run at every moment, not only some" },
  { id: "identity", quality: "moldability", weight: 2, feels: "My chief of agents arrives whole" },
  { id: "takesIdentity", ability: "takesIdentity", quality: "moldability", weight: 2, feels: "It becomes who my files say it is: a name, a voice, rules of its own" },
  { id: "followsStanding", ability: "followsStanding", quality: "moldability", weight: 2, feels: "It follows my standing instructions without being reminded" },
  { id: "steersMidTask", ability: "steersMidTask", quality: "steerability", weight: 2, feels: "I can redirect it while it is working, without stopping it" },
  { id: "extendsSystemPrompt", ability: "extendsSystemPrompt", quality: "moldability", weight: 1, feels: "I can add to or replace the instructions it starts from, beyond a file in my folder" },
];

/** The answer an ability really supports: a yes with no date, version or evidence is unmeasured. */
function settled(a) {
  if (!a || !["yes", "no", "unmeasured"].includes(a.answer)) return "unmeasured";
  if (a.answer === "yes" && !(isDate(a.measured) && filled(a.version) && filled(a.evidence))) return "unmeasured";
  return a.answer;
}

function scoreRow(row, profile) {
  const base = { id: row.id, quality: row.quality, feels: row.feels, weight: row.weight };
  if (row.ability) {
    const a = profile.abilities?.[row.ability] || {};
    const answer = settled(a);
    return { ...base, ability: row.ability, answer, points: answer === "yes" ? row.weight : 0,
      measured: a.measured ?? null, version: a.version ?? null, evidence: a.evidence ?? null };
  }
  if (row.id === "moments") {
    const named = MOMENTS.filter((m) => filled(profile.moments?.[m])).length;
    return { ...base, answer: `${named} of ${MOMENTS.length}`, points: round1((named / MOMENTS.length) * row.weight),
      measured: null, version: null, evidence: `The adapter names ${named} of the standard's ${MOMENTS.length} moments.` };
  }
  // identity
  const d = profile.deliverIdentity;
  const whole = d?.via === "hook-context" || (d?.via === "file" && typeof d.file === "function");
  return { ...base, answer: whole ? d.via : "none", points: whole ? row.weight : 0, measured: null, version: null,
    evidence: whole
      ? (d.via === "file" ? "Instruction files are written to a file the harness reads whole." : "Instruction files arrive as session-start hook context.")
      : "The adapter declares no working route for instruction files." };
}

/**
 * A profile's scorecard. It starts with the pass line: whether the profile is a superharness, and
 * which boxes of the bar it is missing. `qualities` is a subtotal for each of the three qualities. `unmeasured` lists the rows nobody has measured, apart
 * from any no.
 */
export function scoreHarness(profile) {
  const rows = HARNESS_ROWS.map((row) => scoreRow(row, profile));
  const boxes = checkBar(profile);
  const missing = boxes.filter((b) => !b.ok).map((b) => b.id);
  return {
    id: profile.id, label: profile.label,
    superharness: missing.length === 0 && boxes.length === BAR.length,
    bar: { ok: boxes.length - missing.length, total: boxes.length, missing },
    qualities: Object.fromEntries(Object.keys(QUALITIES).map((q) => [q, {
      total: round1(rows.filter((r) => r.quality === q).reduce((n, r) => n + r.points, 0)),
      max: HARNESS_ROWS.filter((r) => r.quality === q).reduce((n, r) => n + r.weight, 0),
    }])),
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
// The recommendation, and the remote control warning
// ---------------------------------------------------------------------------

const NEED_WORDS = {
  phone: "remote control",
  remoteControl: "remote control",
  refuseTool: "a rule that can refuse a tool",
  permissionGate: "a permission gate",
  cardWaits: "a question card that waits for you",
  followsStanding: "standing instructions followed without a reminder",
  steersMidTask: "redirecting it while it works",
  takesIdentity: "an identity taken from your files",
  extendsSystemPrompt: "a way to add to the instructions it starts from",
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
 * Only a superharness is ever picked: a profile that misses a box of the bar ranks below every
 * profile that checks all eleven, whatever it scores. Among superharnesses, one missing a need,
 * by a measured no or because nobody measured it, ranks below every one that has it, and among
 * equals the higher total ranks first. `pick` is null when no superharness meets every need, and
 * `because` says so.
 */
export function recommend({ needs = [] } = {}, profiles = []) {
  const cards = profiles.map((p, i) => {
    const s = scoreHarness(p);
    return { profile: p, i, id: p.id, total: s.total, max: s.max, superharness: s.superharness, boxes: s.bar.missing,
      missing: needs.filter((n) => settled(p.abilities?.[n]) !== "yes") };
  });
  cards.sort((a, b) => Number(b.superharness) - Number(a.superharness) ||
    a.missing.length - b.missing.length || b.total - a.total || a.i - b.i);
  const ranked = cards.map(({ id, total, missing, superharness }) => ({ id, total, missing, superharness }));
  const n = profiles.length;
  if (!n) return { pick: null, because: "No pick: there were no harnesses to score.", ranked };
  const supers = cards.filter((c) => c.superharness);
  const m = supers.length;
  if (!m) {
    const each = cards.map((c) => `${c.profile.label} is missing ${c.boxes.length} of the ${BAR.length} boxes (${c.boxes.join(", ")})`);
    return { pick: null, ranked, because: `No pick: none of the ${n} scored is a superharness. ${each.join(". ")}.` };
  }
  const top = supers[0];
  const pool = `the ${m} superharnesses scored`;
  if (top.missing.length) {
    const each = supers.map((c) => `${c.profile.label} is missing ${listOf(c.missing.map((x) => missingReads(c.profile, x)))}`);
    return { pick: null, ranked,
      because: `No pick: ${m === 1 ? "the only superharness scored does not have" : `none of ${pool} has`} ${listOf(needs.map(words))} measured today. ${each.join(". ")}.` };
  }
  const label = top.profile.label;
  if (!needs.length) {
    return { pick: top.id, ranked,
      because: `${label}, because ${m === 1 ? "it is the only superharness scored" : `it scores highest of ${pool}`} (${top.total} of ${top.max}) and you named no particular need.` };
  }
  const dates = needs.map((need) => `${words(need)}: measured ${top.profile.abilities[need].measured} on ${top.profile.abilities[need].version}`).join("; ");
  const have = supers.filter((c) => !c.missing.length).length;
  const that = needs.length === 1 ? "that" : "all of that";
  const why = m === 1
    ? `it is the only superharness scored and it has ${that} measured today`
    : have === 1
      ? `it is the only one of ${pool} with ${that} measured today`
      : `${have} of ${pool} have ${that} measured today and it scores highest of them (${top.total} of ${top.max})`;
  return { pick: top.id, ranked, because: `${label}, because you need ${listOf(needs.map(words))} and ${why} (${dates}).` };
}

/**
 * The text setup shows before going on inside a harness with no measured remote control.
 * Null when remote control is a measured yes. Otherwise three lines: what cannot be done from a
 * phone, what the answer is and when it was measured, and that the person can continue. Pass
 * `profiles` to have the second line name the harnesses that do have it measured.
 */
export function remoteControlWarning(profile, { profiles = [] } = {}) {
  const a = profile.abilities?.phone;
  const answer = settled(a);
  if (answer === "yes") return null;
  const label = profile.label || profile.id;
  const state = answer === "no"
    ? `no${isDate(a.measured) ? `, measured ${a.measured}` : ""}${filled(a.version) ? ` on ${a.version}` : ""}`
    : "not measured yet";
  const have = profiles.filter((p) => settled(p.abilities?.phone) === "yes").map((p) => p.label || p.id);
  return [
    `Without remote control you cannot reach ${label} from your phone: you will not be able to start a session, check on one that is running, or answer a question it asks.`,
    `Whether ${label} has remote control: ${state}.${have.length ? ` Remote control is measured today for ${listOf(have)}.` : ""}`,
    "You can continue anyway.",
  ].join("\n");
}

/** The name this function had before 0.2.0. Kept so an importer does not break. */
export const phoneLineWarning = remoteControlWarning;
