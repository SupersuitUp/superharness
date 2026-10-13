// The bar: the eleven boxes a harness must check to be a superharness.
//
// Every box is decided ONLY from what the adapter declares. Nothing here starts a harness. A box
// that rests on an ability needs an evidenced yes: the answer "yes" with the date it was measured,
// the version it was measured on, and one sentence saying what was observed. STANDARD.md is the
// same thing for people.
import { questionCardProblem } from "./card.mjs";

export const DEFINITION = "A superharness is a harness you can hand your whole computer and your whole context to, and still be the one in command.";

const box = (id, half, says, needs) => ({ id, half, says, needs });

export const BAR = [
  box("computer", "capability", "It works on your computer: it reads and writes your files and runs programs in folders you choose.",
    ["actions.bin", "places.configDir", "places.transcriptsRoot"]),
  box("instructions", "capability", "It loads your instructions whole, every session.", ["actions.deliverIdentity"]),
  box("skills", "capability", "It reads skills from a folder, in the open skill format.", ["places.skillsDir"]),
  box("tools", "capability", "It can be given new tools through the open connector standard.", ["abilities.mcp"]),
  box("unattended", "capability", "It can work while you are not watching, from a single command.",
    ["abilities.backgroundSession", "actions.startBackground"]),
  box("helpers", "capability", "It can hand work to helper agents.", ["abilities.subagents"]),
  box("refuses", "safety", "It stops before it acts: there is a moment before every tool runs where a rule can say no.",
    ["moments.beforeTool", "abilities.refuseTool"]),
  box("permission", "safety", "It asks permission, and can be restricted to a list of what it may do without asking.",
    ["abilities.permissionGate"]),
  box("record", "safety", "It keeps a full record of every session on your own disk, in a form you can read and take with you.",
    ["places.transcriptsRoot", "actions.isTurn"]),
  box("remoteControl", "safety", "You can reach it from your phone: start a session, check on one, answer it.", ["abilities.phone"]),
  box("questionCard", "safety", "It can ask you a question as a card with choices.",
    ["abilities.askCard", "actions.questionCard"]),
];

const HOME = "/home/probe";
const filled = (s) => typeof s === "string" && s.trim().length > 0;
const isDate = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  // A real calendar day, checked on its parts: no clock, no time zone, nothing to convert.
  const [y, m, d] = s.split("-").map(Number);
  const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1];
};

/** True only for a yes that carries a real date, a version and an evidence sentence. */
export const evidencedYes = (a) =>
  !!a && a.answer === "yes" && isDate(a.measured) && filled(a.version) && filled(a.evidence);

const yes = (why) => ({ ok: true, why });
const no = (why) => ({ ok: false, why });

/** The first problem in a list of [ok, sentence] pairs, or a pass with the given sentence. */
const all = (passWhy, ...checks) => {
  const bad = checks.find(([ok]) => !ok);
  return bad ? no(bad[1]) : yes(passWhy);
};

/** What a place getter returns for the probe home, or undefined when it is absent or throws. */
function place(profile, key) {
  const f = profile?.[key];
  if (typeof f !== "function") return undefined;
  try { return f(HOME); } catch { return undefined; }
}

/** Why an ability is not an evidenced yes, in words a person can act on. */
function abilityCheck(profile, key, name = key) {
  const a = profile?.abilities?.[key];
  if (evidencedYes(a)) return [true, `${name}: yes, measured ${a.measured} on ${a.version}`];
  if (a?.answer === "yes") return [false, `${name} says yes without a date, a version and an evidence sentence`];
  if (a?.answer === "no") return [false, `${name} is a measured no`];
  return [false, `${name} is not measured`];
}

const DECIDE = {
  computer: (p) => all("the program, the settings folder and the record folder are all declared",
    [typeof p?.bin === "function", "bin must be a function"],
    [filled(place(p, "configDir")), "configDir must return a non-empty string"],
    [filled(place(p, "transcriptsRoot")), "transcriptsRoot must return a non-empty string"]),
  instructions: (p) => {
    const d = p?.deliverIdentity;
    if (d?.via === "hook-context") return yes("instructions arrive as session-start hook context");
    if (d?.via === "file") {
      return typeof d.file === "function"
        ? yes("instructions are written to a file the harness reads")
        : no("deliverIdentity via file needs a file getter");
    }
    return no("deliverIdentity.via must be hook-context or file");
  },
  skills: (p) => (filled(place(p, "skillsDir")) ? yes(`skills are read from ${place(p, "skillsDir")}`) : no("skillsDir must return a non-empty string")),
  tools: (p) => { const [ok, why] = abilityCheck(p, "mcp"); return ok ? yes(why) : no(why); },
  unattended: (p) => {
    const a = abilityCheck(p, "backgroundSession");
    return all(a[1], a, [typeof p?.startBackground === "function", "startBackground must be a function"]);
  },
  helpers: (p) => { const [ok, why] = abilityCheck(p, "subagents"); return ok ? yes(why) : no(why); },
  refuses: (p) => {
    const a = abilityCheck(p, "refuseTool");
    return all(`${a[1]}, at ${p?.moments?.beforeTool}`, [filled(p?.moments?.beforeTool), "moments.beforeTool must be named"], a);
  },
  permission: (p) => { const [ok, why] = abilityCheck(p, "permissionGate"); return ok ? yes(why) : no(why); },
  record: (p) => all("the record folder is declared and a turn can be told from the rest",
    [typeof place(p, "transcriptsRoot") === "string", "transcriptsRoot must return a string"],
    [typeof p?.isTurn === "function", "isTurn must be a function"]),
  remoteControl: (p) => { const [ok, why] = abilityCheck(p, "phone", "remote control"); return ok ? yes(why) : no(why); },
  questionCard: (p) => {
    const a = abilityCheck(p, "askCard");
    const declared = p?.questionCard !== undefined && p?.questionCard !== null;
    const problem = declared ? questionCardProblem(p.questionCard) : null;
    return all(`${a[1]}, through ${p?.questionCard?.tools?.join(" or ")}`, a,
      [declared, "questionCard is not declared"], [!problem, `questionCard ${problem}`]);
  },
};

/** One row per box, in the bar's order. Never throws: a profile it cannot read fails every box it touches. */
export function checkBar(profile) {
  const p = profile && typeof profile === "object" ? profile : {};
  return BAR.map((b) => {
    let r;
    try { r = DECIDE[b.id](p); } catch (e) { r = no(`could not be decided: ${e.message}`); }
    return { id: b.id, half: b.half, ok: r.ok === true, why: r.why };
  });
}

/** True only when every one of the eleven boxes is checked. */
export function isSuperharness(profile) {
  const rows = checkBar(profile);
  return rows.length === BAR.length && rows.every((r) => r.ok === true);
}
