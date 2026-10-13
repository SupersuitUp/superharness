// The check: one result per clause of the standard, then one per box of the bar, for any profile.
//
// The check walks CLAUSES, so a new clause or a new adapter never means a new checker. It has two
// halves. `checkStatic` reads the profile and needs nothing installed. `checkLive` needs a machine
// that has the harness, and only it can turn "unmeasured" into something observed.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { CLAUSES } from "./contract.mjs";
import { BAR, checkBar } from "./bar.mjs";
import { questionCardProblem } from "./card.mjs";

const ANSWERS = ["yes", "no", "unmeasured"];
const ROUTES = ["hook-context", "file"];
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const filled = (s) => typeof s === "string" && s.trim().length > 0;

/** Where a clause's answer lives on a profile. */
function valueOf(profile, clause) {
  if (clause.group === "moments") return profile?.moments?.[clause.key];
  if (clause.group === "abilities") return profile?.abilities?.[clause.key];
  if (clause.group === "vocabulary") return profile?.vocabulary?.[clause.key];
  return profile?.[clause.key];
}

const pass = (why) => ({ ok: true, why });
const fail = (why) => ({ ok: false, why });

/** The arguments a place getter is called with. */
const placeArgs = (key, home) => (key === "transcriptPath" ? [home, "/w", "sid"] : [home]);

function checkFunction(clause, v, home) {
  if (typeof v !== "function") return fail(`must be a function, got ${v === null ? "null" : typeof v}`);
  if (clause.group !== "places") return pass("a function");
  let out;
  try { out = v(...placeArgs(clause.key, home)); } catch (e) { return fail(`threw when called: ${e.message}`); }
  if (clause.level === "core") return filled(out) ? pass(out) : fail("a core place must return a non-empty string");
  if (out === null) return pass("returns null: the harness has none");
  return typeof out === "string" ? pass(out) : fail(`must return a string or null, got ${typeof out}`);
}

function checkNullableFunction(v) {
  if (v === null) return pass("null: the harness cannot");
  if (typeof v !== "function") return fail(`must be a function or null, got ${typeof v}`);
  let out;
  try { out = v({ prompt: "probe", name: "probe", cwd: "/w" }); } catch (e) { return fail(`threw when called: ${e.message}`); }
  return out && typeof out.cmd === "string" && out.cmd && Array.isArray(out.args)
    ? pass(`${out.cmd} ${out.args.join(" ")}`)
    : fail("must return { cmd: string, args: array }");
}

function checkString(clause, v) {
  const nullable = clause.group === "moments" || clause.group === "vocabulary";
  if (v === null && nullable) {
    return clause.level === "core" ? fail("a core moment must be named") : pass("null: the harness has none");
  }
  if (typeof v !== "string") return fail(`must be a string${nullable ? " or null" : ""}, got ${v === null ? "null" : typeof v}`);
  return v.trim() ? pass(v) : fail("must not be empty");
}

function checkIdentity(v, home) {
  if (!v || typeof v !== "object") return fail("must be an object: { via, file?, maxChars? }");
  if (!ROUTES.includes(v.via)) return fail(`via must be one of ${ROUTES.join(", ")}`);
  if ("maxChars" in v && !(Number.isFinite(v.maxChars) && v.maxChars > 0)) return fail("maxChars must be a positive number");
  if (v.via === "file") {
    if (typeof v.file !== "function") return fail("via file needs file: (home) => path");
    let out;
    try { out = v.file(home); } catch (e) { return fail(`file threw when called: ${e.message}`); }
    return filled(out) ? pass(`file ${out}`) : fail("file must return a non-empty string");
  }
  return pass(v.via);
}

function checkAbility(v) {
  if (!v || typeof v !== "object") return fail("must be an object: { answer, measured, version, evidence }");
  if (!ANSWERS.includes(v.answer)) return fail(`answer must be one of ${ANSWERS.join(", ")}`);
  if (v.answer !== "yes") return pass(v.answer);
  const missing = [!isDate(v.measured) && "measured (YYYY-MM-DD)", !filled(v.version) && "version", !filled(v.evidence) && "evidence"].filter(Boolean);
  return missing.length ? fail(`a yes needs ${missing.join(", ")}`) : pass(`yes, measured ${v.measured} on ${v.version}`);
}

function checkClause(profile, clause, home) {
  const v = valueOf(profile, clause);
  const absent = v === undefined || (v === null && clause.kind !== "nullable-function" && clause.kind !== "string");
  if (absent) return clause.level === "core" ? fail("missing, and the core requires it") : pass("not provided");
  if (clause.kind === "function") return checkFunction(clause, v, home);
  if (clause.kind === "nullable-function") return checkNullableFunction(v);
  if (clause.kind === "string") return checkString(clause, v);
  if (clause.group === "abilities") return checkAbility(v);
  if (clause.key === "deliverIdentity") return checkIdentity(v, home);
  if (clause.key === "questionCard") {
    const problem = questionCardProblem(v);
    return problem ? fail(problem) : pass(`${v.tools.join(", ")}; answered by ${v.answeredBy}`);
  }
  return v && typeof v === "object" ? pass("an object") : fail("must be an object");
}

/**
 * Purity: no place getter may read the ambient environment. The environment is the factory's
 * argument and the home is the getter's, so a test, a probe and a background job agree.
 */
function checkPurity(profile, home) {
  const real = process.env;
  const readers = [];
  process.env = new Proxy({}, { get() { throw new Error("read process.env"); }, has() { throw new Error("read process.env"); } });
  try {
    for (const clause of CLAUSES.filter((c) => c.group === "places")) {
      const f = profile?.[clause.key];
      if (typeof f !== "function") continue;
      try { f(...placeArgs(clause.key, home)); } catch (e) { if (/read process\.env/.test(e.message)) readers.push(clause.key); }
    }
  } finally { process.env = real; }
  return readers.length
    ? fail(`these place getters read process.env: ${readers.join(", ")}`)
    : pass("no place getter reads process.env");
}

/**
 * One result per clause, in the standard's order, then the purity rule, then one row per box of
 * the bar (`bar.<id>`, level "bar"). Needs nothing installed.
 */
export function checkStatic(profile, { home = "/home/probe" } = {}) {
  const results = CLAUSES.map((clause) => ({ id: clause.id, level: clause.level, ...checkClause(profile, clause, home) }));
  results.push({ id: "purity", level: "core", ...checkPurity(profile, home) });
  for (const b of checkBar(profile)) results.push({ id: `bar.${b.id}`, level: "bar", half: b.half, ok: b.ok, why: b.why });
  return results;
}

/**
 * Two answers. `pass` is about the clauses: every core row is ok and nothing is malformed.
 * `superharness` is about the bar: all eleven boxes are checked. A box that is not checked is a
 * missing box, listed in `bar.missing`; it is not a malformed clause and is never in `failed`.
 * A row with `ok: null` was skipped or could not be measured here; it is neither a pass nor a
 * failure.
 */
export function summarize(results) {
  const clauses = results.filter((r) => r.level !== "bar");
  const boxes = results.filter((r) => r.level === "bar");
  const count = (level) => {
    const rows = clauses.filter((r) => r.level === level && r.ok !== null);
    return { ok: rows.filter((r) => r.ok === true).length, total: rows.length };
  };
  const failed = clauses.filter((r) => r.ok === false).map((r) => r.id);
  const core = count("core"), optional = count("optional");
  const bar = {
    ok: boxes.filter((r) => r.ok === true).length,
    total: boxes.length,
    missing: boxes.filter((r) => r.ok !== true).map((r) => r.id.replace(/^bar\./, "")),
  };
  return { pass: failed.length === 0 && core.ok === core.total, core, optional, failed,
    superharness: bar.total === BAR.length && bar.ok === bar.total, bar };
}

const defaultRun = (cmd, args) =>
  execFileSync(cmd, args, { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "ignore"] });

const notFound = (e) => e?.code === "ENOENT" || /ENOENT/.test(String(e?.message || ""));

const SESSION_PROBES = ["hookFires", "identityArrives", "recordReadable"];

/**
 * The rows that need a machine. `run` and `exists` are injectable so a test never starts a real
 * harness. A harness that is not installed is skipped, never failed. The session-level rows are
 * declared and left unmeasured here: they need a session a person can watch.
 */
export async function checkLive(profile, { home = homedir(), run = defaultRun, exists = existsSync } = {}) {
  const results = [];
  const skip = "harness not installed";
  let bin = null, absent = false;
  // The adapter's own resolver is handed the same injected filesystem and runner, so finding the
  // program never touches more of the machine than the caller allowed.
  const version = (path) => {
    try { return String(run(path, ["--version"]) ?? "").match(/(\d+\.\d+\.\d+)/)?.[1] ?? null; } catch { return null; }
  };
  try { bin = profile.bin({ home, exists, version }); } catch { bin = null; }
  if (!filled(bin)) {
    absent = true;
    results.push({ id: "live.bin", level: "optional", ok: null, why: skip });
  } else {
    try {
      const version = String(run(bin, ["--version"]) ?? "").trim();
      results.push({ id: "live.bin", level: "optional", ok: true, why: `${bin} --version printed ${version || "nothing"}`, version });
    } catch (e) {
      if (notFound(e)) { absent = true; results.push({ id: "live.bin", level: "optional", ok: null, why: skip }); }
      else results.push({ id: "live.bin", level: "optional", ok: false, why: `${bin} --version did not exit 0: ${e.message}` });
    }
  }
  if (absent) results.push({ id: "live.configDir", level: "optional", ok: null, why: skip });
  else {
    let dir = null;
    try { dir = profile.configDir(home); } catch { dir = null; }
    const there = filled(dir) && exists(dir);
    results.push({ id: "live.configDir", level: "optional", ok: there, why: there ? `${dir} exists` : `${dir} does not exist` });
  }
  for (const p of SESSION_PROBES) {
    results.push({ id: `live.session.${p}`, level: "optional", ok: null, why: "needs an interactive probe; see STANDARD.md, Live check" });
  }
  return results;
}
