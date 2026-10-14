#!/usr/bin/env node
// superharness: ask the superharness standard a question from a shell, or from any language
// that can run a command. Text in, text out. Exit codes: 0 ok or yes, 1 no or failed, 2 usage.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  STANDARD_VERSION, CLAUSES, BAR, DEFINITION, HARNESSES, BUILTIN, MODEL_RESULTS,
  harnessId, isSwapped, loadAdapter, checkStatic, checkLive, summarize, checkBar,
  scoreHarness, standing, recommend, remoteControlWarning,
} from "../src/index.mjs";

/** The places that are paths. isInsidePluginFolder answers a question about a path and is not one. */
const PATH_PLACES = CLAUSES.filter((c) => c.group === "places" && c.kind === "function").map((c) => c.key);

const HELP = `superharness: the superharness standard, and the check for it.

${DEFINITION}
A harness is a superharness when it checks all ${BAR.length} boxes of the bar.

Usage:
  superharness list [--json]
      The harnesses this package ships an adapter for.
  superharness which [--json] [--home <dir>]
      The harness this machine is set to. FREEDOM_HARNESS wins, then "harness" in
      <home>/.freedom/config.json, then claude-code.
  superharness path <place> [--harness <id|file>] [--home <dir>]
      One path, and nothing else. Exit 1 when the harness has no such place.
      Places: ${PATH_PLACES.join(", ")}.
      transcriptPath also takes --cwd <dir> and --session <id>. bridgePointerFile takes --cwd <dir>.
      worktreesDir and projectDir take --root <dir>.
  superharness can <ability> [--harness <id|file>]
      Prints yes, no or unmeasured. Exit 0 only for yes.
  superharness check <id|file> [--live] [--json]
      One line per clause of the standard (PASS, FAIL or SKIP) and a clause summary, then one
      line per box of the bar, then SUPERHARNESS or NOT A SUPERHARNESS.
      --live adds the rows that need the harness installed on this machine.
      Exit 0 only for a superharness with nothing malformed.
  superharness bar <id|file> [--json]
      Only the ${BAR.length} boxes: one line each. Exit 0 only when all ${BAR.length} are checked.
  superharness rubric [--json] [--needs <a,b>] [--harness <id|file>]
      Whether each harness is a superharness, then its scorecard. With --needs, the last line
      is the recommendation. Exit 1 when a need was named and no superharness meets it.
  superharness warn <id|file>
      The remote control warning for a harness. Prints nothing when it has remote control measured.
  superharness --help
  superharness --version

A harness is a shipped id (${HARNESSES.join(", ")}) or the path to an adapter file.
Exit codes: 0 ok or yes, 1 no or failed, 2 usage.
`;

class Usage extends Error {}

const VALUE_FLAGS = ["--harness", "--home", "--needs", "--cwd", "--session", "--root"];
const BOOL_FLAGS = ["--json", "--live", "--help", "-h", "--version"];

function parse(argv) {
  const flags = {}, rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUE_FLAGS.includes(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) throw new Usage(`${a} needs a value`);
      flags[a.slice(2)] = v; i++;
    } else if (BOOL_FLAGS.includes(a)) flags[a.replace(/^-+/, "")] = true;
    else if (a.startsWith("-")) throw new Usage(`unknown option ${a}`);
    else rest.push(a);
  }
  return { flags, rest };
}

const out = (s) => process.stdout.write(s.endsWith("\n") ? s : `${s}\n`);
const json = (o) => out(JSON.stringify(o, null, 2));

/** A profile from a shipped id or an adapter file, built with this process's environment. */
async function profileOf(target) {
  let factory;
  try { factory = await loadAdapter(target); } catch (e) {
    throw new Usage(`cannot load the harness "${target}": not a shipped id (${HARNESSES.join(", ")}) and not a readable adapter file (${e.message})`);
  }
  return factory(process.env);
}

const shipped = () => HARNESSES.map((id) => BUILTIN[id](process.env));

async function main(argv) {
  const { flags, rest } = parse(argv);
  const [cmd, arg] = rest;
  if (flags.help || flags.h) { out(HELP); return 0; }
  if (flags.version) {
    const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"));
    out(`${pkg.version} (standard ${STANDARD_VERSION})`);
    return 0;
  }
  if (!cmd) throw new Usage("no command given");
  const home = flags.home || homedir();
  const resolved = () => profileOf(flags.harness || harnessId({ env: process.env, home }));

  if (cmd === "list") {
    const all = shipped().map((p) => ({ id: p.id, label: p.label }));
    if (flags.json) json(all); else out(all.map((p) => `${p.id}\t${p.label}`).join("\n"));
    return 0;
  }

  if (cmd === "which") {
    const id = harnessId({ env: process.env, home });
    if (flags.json) json({ id, label: BUILTIN[id]({}).label, swapped: isSwapped({ env: process.env, home }) });
    else out(id);
    return 0;
  }

  if (cmd === "path") {
    const places = PATH_PLACES;
    if (!arg) throw new Usage(`path needs a place: ${places.join(", ")}`);
    if (!places.includes(arg)) throw new Usage(`unknown place "${arg}". Places: ${places.join(", ")}`);
    const p = await resolved();
    if (typeof p[arg] !== "function") return 1;
    const args = arg === "transcriptPath" ? [home, flags.cwd || process.cwd(), flags.session || ""]
      : arg === "bridgePointerFile" ? [home, flags.cwd || process.cwd()]
      : arg === "worktreesDir" || arg === "projectDir" ? [flags.root || process.cwd()]
      : [home];
    const v = p[arg](...args);
    if (typeof v !== "string" || !v) return 1;
    out(v);
    return 0;
  }

  if (cmd === "can") {
    if (!arg) throw new Usage("can needs an ability, for example: can remoteControl");
    const p = await resolved();
    const answer = p.abilities?.[arg]?.answer;
    const said = ["yes", "no", "unmeasured"].includes(answer) ? answer : "unmeasured";
    out(said);
    return said === "yes" && p.can[arg] === true ? 0 : 1;
  }

  const BOX = Object.fromEntries(BAR.map((b) => [b.id, b]));
  const boxWidth = Math.max(...BAR.map((b) => b.id.length));
  /** One line for one box: PASS or FAIL, its id, its half, its sentence, and why when it fails. */
  const boxLine = (b) =>
    `${b.ok ? "PASS" : "FAIL"}  ${b.id.padEnd(boxWidth)}  ${b.half.padEnd(10)}  ${BOX[b.id].says}${b.ok ? "" : ` Missing: ${b.why}.`}`;
  /** The last line of `check` and `bar`. */
  const verdict = (p, boxes, malformed = []) => {
    const ok = boxes.filter((b) => b.ok).length;
    const missing = boxes.filter((b) => !b.ok).map((b) => b.id);
    if (missing.length) return `NOT A SUPERHARNESS ${p.id}: ${ok} of ${boxes.length}, missing: ${missing.join(", ")}`;
    if (malformed.length) return `NOT A SUPERHARNESS ${p.id}: ${ok} of ${boxes.length}, malformed: ${malformed.join(", ")}`;
    return `SUPERHARNESS ${p.id}: ${ok} of ${boxes.length} (standard ${STANDARD_VERSION})`;
  };

  if (cmd === "check") {
    if (!arg) throw new Usage("check needs a harness: a shipped id or the path to an adapter file");
    const p = await profileOf(arg);
    const results = [...checkStatic(p), ...(flags.live ? await checkLive(p, { home }) : [])];
    const s = summarize(results);
    const boxes = checkBar(p);
    const superharness = s.superharness && s.pass;
    if (flags.json) {
      json({ harness: p.id, label: p.label, standard: STANDARD_VERSION, contract: STANDARD_VERSION, superharness,
        bar: s.bar, boxes, pass: s.pass, core: s.core, optional: s.optional, failed: s.failed, results });
    } else {
      const word = (r) => (r.ok === true ? "PASS" : r.ok === false ? "FAIL" : "SKIP");
      const rows = results.filter((r) => r.level !== "bar");
      const width = Math.max(...rows.map((r) => r.id.length));
      out(rows.map((r) => `${word(r)}  ${r.id.padEnd(width)}  ${r.level.padEnd(8)}  ${r.why}`).join("\n"));
      out(`clauses: core ${s.core.ok} of ${s.core.total}, optional ${s.optional.ok} of ${s.optional.total}` +
        (s.failed.length ? `, failed: ${s.failed.join(", ")}` : ""));
      out(boxes.map(boxLine).join("\n"));
      out(verdict(p, boxes, s.failed));
    }
    return superharness ? 0 : 1;
  }

  if (cmd === "bar") {
    if (!arg) throw new Usage("bar needs a harness: a shipped id or the path to an adapter file");
    const p = await profileOf(arg);
    const boxes = checkBar(p);
    const missing = boxes.filter((b) => !b.ok).map((b) => b.id);
    if (flags.json) {
      json({ harness: p.id, label: p.label, standard: STANDARD_VERSION, superharness: missing.length === 0,
        bar: { ok: boxes.length - missing.length, total: boxes.length, missing },
        boxes: boxes.map((b) => ({ ...b, says: BOX[b.id].says })) });
    } else out(boxes.map(boxLine).join("\n"));
    return missing.length ? 1 : 0;
  }

  if (cmd === "rubric") {
    const profiles = flags.harness ? [await profileOf(flags.harness)] : shipped();
    const cards = profiles.map((p) => ({ ...scoreHarness(p), standing: standing(p) }));
    const needs = flags.needs ? flags.needs.split(",").map((s) => s.trim()).filter(Boolean) : null;
    const rec = needs ? recommend({ needs }, profiles) : null;
    if (flags.json) {
      json({ standard: STANDARD_VERSION, contract: STANDARD_VERSION, harnesses: cards, modelResults: MODEL_RESULTS, ...(rec ? { recommendation: rec } : {}) });
    } else {
      const shown = (r) => (r.answer === "unmeasured" ? "not measured" : r.answer);
      const when = (r) => (r.ability && r.answer !== "unmeasured" && r.measured ? `, measured ${r.measured} on ${r.version}` : "");
      for (const c of cards) {
        const st = c.standing;
        out(c.superharness
          ? `${c.label}: ${st.says}. Superharness, ${c.bar.ok} of ${c.bar.total} (standard ${STANDARD_VERSION})${st.shortfalls.length ? `. Measured shortfalls: ${st.shortfalls.join(", ")}` : ""}${st.id === "recommended" && st.unmeasured.length ? `. Not measured yet: ${st.unmeasured.join(", ")}` : ""}`
          : `${c.label}: not a superharness, ${c.bar.ok} of ${c.bar.total}, missing: ${c.bar.missing.join(", ")}`);
      }
      out("");
      for (const c of cards) {
        out(`${c.label}  ${c.total} of ${c.max}`);
        out(`  ${Object.entries(c.qualities).map(([q, v]) => `${q} ${v.total} of ${v.max}`).join(", ")}`);
        for (const r of c.rows) {
          out(`  ${String(r.points).padStart(3)} of ${r.weight}  ${r.feels}: ${shown(r)}${when(r)}`);
          if (r.evidence) out(`            ${r.evidence}`);
        }
        if (c.unmeasured.length) out(`  not measured: ${c.unmeasured.join(", ")}`);
        out("");
      }
      out("No model results ship with this package. A model scorecard is filled by a recorded run; see RUBRIC.md.");
      if (rec) { out(""); out(rec.because); }
    }
    return rec && rec.pick === null ? 1 : 0;
  }

  if (cmd === "warn") {
    if (!arg) throw new Usage("warn needs a harness: a shipped id or the path to an adapter file");
    const w = remoteControlWarning(await profileOf(arg), { profiles: shipped() });
    if (w) out(w);
    return 0;
  }

  throw new Usage(`unknown command "${cmd}"`);
}

main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code; },
  (e) => {
    if (e instanceof Usage) { process.stderr.write(`${e.message}\n\n${HELP}`); process.exitCode = 2; }
    else { process.stderr.write(`${e.stack || e.message}\n`); process.exitCode = 1; }
  },
);
