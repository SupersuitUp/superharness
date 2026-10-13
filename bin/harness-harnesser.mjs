#!/usr/bin/env node
// harness-harnesser: ask the harness contract a question from a shell, or from any language that
// can run a command. Text in, text out. Exit codes: 0 ok or yes, 1 no or failed, 2 usage.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTRACT_VERSION, CLAUSES, HARNESSES, BUILTIN, MODEL_RESULTS,
  harnessId, isSwapped, loadAdapter, checkStatic, checkLive, summarize,
  scoreHarness, recommend, phoneLineWarning,
} from "../src/index.mjs";

const HELP = `harness-harnesser: a public contract any agent harness can pass.

Usage:
  harness-harnesser list [--json]
      The harnesses this package ships an adapter for.
  harness-harnesser which [--json] [--home <dir>]
      The harness this machine is set to. FREEDOM_HARNESS wins, then "harness" in
      <home>/.freedom/config.json, then claude-code.
  harness-harnesser path <place> [--harness <id|file>] [--home <dir>]
      One path, and nothing else. Exit 1 when the harness has no such place.
      Places: ${CLAUSES.filter((c) => c.group === "places").map((c) => c.key).join(", ")}.
      transcriptPath also takes --cwd <dir> and --session <id>. worktreesDir takes --root <dir>.
  harness-harnesser can <ability> [--harness <id|file>]
      Prints yes, no or unmeasured. Exit 0 only for yes.
  harness-harnesser check <id|file> [--live] [--json]
      One line per clause of the contract (PASS, FAIL or SKIP), then a summary line.
      --live adds the rows that need the harness installed on this machine.
      Exit 0 when every core clause passes and nothing is malformed.
  harness-harnesser rubric [--json] [--needs <a,b>] [--harness <id|file>]
      The scorecard for each harness. With --needs, the last line is the recommendation.
      Exit 1 when a need was named and no harness meets it.
  harness-harnesser warn <id|file>
      The phone line warning for a harness. Prints nothing when it has a measured line.
  harness-harnesser --help
  harness-harnesser --version

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
    out(`${pkg.version} (contract ${CONTRACT_VERSION})`);
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
    const places = CLAUSES.filter((c) => c.group === "places").map((c) => c.key);
    if (!arg) throw new Usage(`path needs a place: ${places.join(", ")}`);
    if (!places.includes(arg)) throw new Usage(`unknown place "${arg}". Places: ${places.join(", ")}`);
    const p = await resolved();
    if (typeof p[arg] !== "function") return 1;
    const args = arg === "transcriptPath" ? [home, flags.cwd || process.cwd(), flags.session || ""]
      : arg === "worktreesDir" ? [flags.root || process.cwd()]
      : [home];
    const v = p[arg](...args);
    if (typeof v !== "string" || !v) return 1;
    out(v);
    return 0;
  }

  if (cmd === "can") {
    if (!arg) throw new Usage("can needs an ability, for example: can phone");
    const p = await resolved();
    const answer = p.abilities?.[arg]?.answer;
    const said = ["yes", "no", "unmeasured"].includes(answer) ? answer : "unmeasured";
    out(said);
    return said === "yes" && p.can[arg] === true ? 0 : 1;
  }

  if (cmd === "check") {
    if (!arg) throw new Usage("check needs a harness: a shipped id or the path to an adapter file");
    const p = await profileOf(arg);
    const results = [...checkStatic(p), ...(flags.live ? await checkLive(p, { home }) : [])];
    const s = summarize(results);
    if (flags.json) {
      json({ harness: p.id, label: p.label, contract: CONTRACT_VERSION, pass: s.pass, core: s.core, optional: s.optional, failed: s.failed, results });
    } else {
      const word = (r) => (r.ok === true ? "PASS" : r.ok === false ? "FAIL" : "SKIP");
      const width = Math.max(...results.map((r) => r.id.length));
      out(results.map((r) => `${word(r)}  ${r.id.padEnd(width)}  ${r.level.padEnd(8)}  ${r.why}`).join("\n"));
      out(`${s.pass ? "PASS" : "FAIL"} ${p.id}: contract ${CONTRACT_VERSION}, core ${s.core.ok} of ${s.core.total}, optional ${s.optional.ok} of ${s.optional.total}` +
        (s.failed.length ? `, failed: ${s.failed.join(", ")}` : ""));
    }
    return s.pass ? 0 : 1;
  }

  if (cmd === "rubric") {
    const profiles = flags.harness ? [await profileOf(flags.harness)] : shipped();
    const cards = profiles.map(scoreHarness);
    const needs = flags.needs ? flags.needs.split(",").map((s) => s.trim()).filter(Boolean) : null;
    const rec = needs ? recommend({ needs }, profiles) : null;
    if (flags.json) {
      json({ contract: CONTRACT_VERSION, harnesses: cards, modelResults: MODEL_RESULTS, ...(rec ? { recommendation: rec } : {}) });
    } else {
      const shown = (r) => (r.answer === "unmeasured" ? "not measured" : r.answer);
      const when = (r) => (r.ability && r.answer !== "unmeasured" && r.measured ? `, measured ${r.measured} on ${r.version}` : "");
      for (const c of cards) {
        out(`${c.label}  ${c.total} of ${c.max}`);
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
    const w = phoneLineWarning(await profileOf(arg), { profiles: shipped() });
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
