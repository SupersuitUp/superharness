# @supersuit/harness-harnesser

A public contract any agent harness can pass, written as data and as a page you can read. It ships the two adapters that pass it today, Claude Code and Codex, and a check that prints pass or fail for every line of the contract. It also ships a rubric that scores what each harness has been measured to do, so a recommendation is the scorecard read aloud.

Zero dependencies. Node 20 or later.

- [CONTRACT.md](./CONTRACT.md): the contract, clause by clause, and how to write an adapter.
- [RUBRIC.md](./RUBRIC.md): the scorecards, the weights, and the protocol for every model task.

## Install

```sh
npm install @supersuit/harness-harnesser
```

Or run it without installing:

```sh
npx @supersuit/harness-harnesser list
```

## The commands

Every command is text in, text out. Exit codes: 0 for ok or yes, 1 for no or failed, 2 for a usage error. Add `--json` to `list`, `which`, `check` and `rubric` for output a program can read.

### `harness-harnesser list`

The harnesses this package ships an adapter for.

```
$ harness-harnesser list
claude-code	Claude Code
codex	Codex
```

### `harness-harnesser which`

The harness this machine is set to. The `FREEDOM_HARNESS` environment variable wins, then `harness` in `~/.freedom/config.json`, then `claude-code`. An unknown name falls back to `claude-code` and never fails.

```
$ harness-harnesser which
claude-code
$ FREEDOM_HARNESS=codex harness-harnesser which
codex
```

### `harness-harnesser path`

One path and nothing else, so a shell script can use it directly. It exits 1 when the harness has no such place.

```
$ harness-harnesser path skillsDir --harness codex --home /Users/you
/Users/you/.codex/skills
$ harness-harnesser path transcriptPath --harness claude-code --home /Users/you --cwd /a/b --session s1
/Users/you/.claude/projects/-a-b/s1.jsonl
$ harness-harnesser path sessionsDir --harness codex; echo "exit $?"
exit 1
```

Places: `configDir`, `skillsDir`, `transcriptsRoot`, `settingsFile`, `pluginCacheDir`, `marketplacesDir`, `sessionsDir`, `transcriptPath`, `worktreesDir`. Without `--harness` it uses the one `which` reports. Without `--home` it uses your home folder. `worktreesDir` takes `--root <project folder>`.

### `harness-harnesser can`

Prints `yes`, `no` or `unmeasured`. It exits 0 only for `yes`.

```
$ harness-harnesser can phone --harness claude-code; echo "exit $?"
yes
exit 0
$ harness-harnesser can phone --harness codex; echo "exit $?"
unmeasured
exit 1
```

### `harness-harnesser check`

One line per clause of the contract, then a summary line. The target is a shipped id or the path to an adapter file.

```
$ harness-harnesser check codex | tail -5
PASS  abilities.askCard              optional  unmeasured
PASS  vocabulary.askOperator         optional  null: the harness has none
PASS  vocabulary.note                optional  AskUserQuestion is Claude Code's tool name, and Codex does not expose a tool by that name. Where a skill says AskUserQuestion, use the question card tool this session actually exposes (request_user_input_async, or request_user_input where its own description allows it). When neither is exposed, ask the question plainly in chat and keep the decision pending until the person answers.
PASS  purity                         core      no place getter reads process.env
PASS codex: contract 1.0.0, core 7 of 7, optional 35 of 35
```

An adapter that leaves out a core clause fails, and the summary names the clause:

```
$ harness-harnesser check ./broken.mjs | tail -1; echo "exit $?"
FAIL broken: contract 1.0.0, core 6 of 7, optional 35 of 35, failed: places.skillsDir
exit 1
```

`--live` adds the rows that need the harness installed on this machine. It runs the harness's program with `--version` and nothing else. A harness that is not installed is skipped, never failed. The rows that need a real session are printed as `SKIP`; see [CONTRACT.md, Live check](./CONTRACT.md#live-check).

```
$ harness-harnesser check codex --live | grep live
PASS  live.bin                       optional  codex --version printed codex-cli 0.162.1
PASS  live.configDir                 optional  /Users/you/.codex exists
SKIP  live.session.hookFires         optional  needs an interactive probe; see CONTRACT.md, Live check
SKIP  live.session.identityArrives   optional  needs an interactive probe; see CONTRACT.md, Live check
SKIP  live.session.recordReadable    optional  needs an interactive probe; see CONTRACT.md, Live check
```

### `harness-harnesser rubric`

The scorecard for each harness, with the date, the version and the evidence behind every row. With `--needs`, the last line is the recommendation. It exits 1 when you named a need and no harness meets it.

```
$ harness-harnesser rubric --needs phone
Claude Code  13.6 of 14
    3 of 3  I can reach it from my phone: yes, measured 2026-10-13 on 2.1.296 (Claude Code)
            `claude --help` on this version lists `--remote-control`, and the com.getfreedom.remotecontrol LaunchAgent that runs `claude remote-control` was loaded on the measuring Mac.
    2 of 2  It can work while I am not watching: yes, measured 2026-10-13 on 2.1.296 (Claude Code)
  ...

Codex  8.7 of 14
    0 of 3  I can reach it from my phone: not measured
            `codex features list` on 0.156.0 (2026-09-22) reported remote_control as removed and off. No other route to a phone was tried on a session that ran, so this is not a measured no.
    2 of 2  It can work while I am not watching: yes, measured 2026-09-24 on 0.156.0
  ...
  not measured: phone, askCard

No model results ship with this package. A model scorecard is filled by a recorded run; see RUBRIC.md.

Claude Code, because you need a line to your phone and it is the only one of the 2 scored with that measured today (a line to your phone: measured 2026-10-13 on 2.1.296 (Claude Code)).
```

The `...` lines stand for the remaining rows, which the real command prints in full.

### `harness-harnesser warn`

The text to show someone before they set up inside a harness with no measured line to their phone. It prints nothing for a harness that has one.

```
$ harness-harnesser warn codex
From your phone you will not be able to start a session in Codex, check on one that is running, or answer a question it asks.
Whether Codex has a line to your phone: not measured yet. A measured line today: Claude Code.
You can continue anyway.
$ harness-harnesser warn claude-code
```

### `harness-harnesser --help`

Prints every command with its options. `harness-harnesser --version` prints the package version and the contract version:

```
$ harness-harnesser --version
0.1.1 (contract 1.0.0)
```

## The library

```js
import {
  harness, harnessId, loadAdapter, register,
  checkStatic, checkLive, summarize,
  scoreHarness, recommend, phoneLineWarning,
  CONTRACT_VERSION, CLAUSES, ABILITIES, MOMENTS,
} from "@supersuit/harness-harnesser";

// The profile for this machine. Every path on it is a function of the home you pass.
const h = harness({ env: process.env, home: "/Users/you" });
h.id;                       // "claude-code"
h.skillsDir("/Users/you");  // "/Users/you/.claude/skills"
h.moments.toolFailed;       // "PostToolUseFailure", or null on a harness that has no such event
h.can.phone;                // true only for a measured yes
h.abilities.phone;          // { answer, measured, version, evidence }

// Does a profile pass the contract?
summarize(checkStatic(h));  // { pass: true, core: { ok: 7, total: 7 }, optional: { ... }, failed: [] }

// Which harness for someone who needs the phone line?
const codex = (await loadAdapter("codex"))({});
recommend({ needs: ["phone"] }, [h, codex]).because;
```

| Export | What it is |
| --- | --- |
| `CONTRACT_VERSION`, `CLAUSES`, `ABILITIES`, `MOMENTS` | The contract as data |
| `defineHarness(spec)` | Turns an adapter's answers into a full profile: every ability answered, every moment named or null, `events`, and `can` |
| `BUILTIN`, `HARNESSES`, `PROFILES`, `DEFAULT_HARNESS` | The shipped adapters, their ids, a built profile of each, and `"claude-code"` |
| `loadAdapter(pathOrId)` | An adapter factory from a shipped id or a file. Async |
| `register(id, factory)` | Makes an outside adapter resolvable by id |
| `harnessId(opts)`, `harness(opts)`, `isSwapped(opts)`, `installed(profile, home)` | The resolver. `opts` is `{ env, home, config, envVar, configFile }`; `envVar` defaults to `FREEDOM_HARNESS` and `configFile` to `(home) => home/.freedom/config.json`, so another product can use its own names |
| `checkStatic(profile)`, `checkLive(profile, opts)`, `summarize(results)` | The conformance check |
| `HARNESS_ROWS`, `scoreHarness(profile)` | The harness scorecard |
| `MODEL_ROWS`, `MODEL_RESULTS`, `scoreModel(results)` | The model scorecard. `MODEL_RESULTS` is empty: a model scorecard is filled only by a recorded run |
| `recommend({ needs }, profiles)` | `{ pick, because, ranked }` |
| `phoneLineWarning(profile, { profiles })` | Three lines, or `null` for a measured line |
| `slugCwd(cwd)`, `isCodexTurn(line)` | Two helpers the adapters use, exported by name |

The program finder the Claude Code adapter uses is a separate entry point:

```js
import { claudeBin, claudeInstalls } from "@supersuit/harness-harnesser/bin-resolver";
```

## Add your harness

An adapter is one file. This one answers the six core clauses and passes:

```js
// toy.mjs
export default (env) => ({
  id: "toy",
  label: "Toy",
  configDir: (home) => home + "/.toy",
  skillsDir: (home) => home + "/.toy/skills",
  transcriptsRoot: (home) => home + "/.toy/log",
  bin: () => "toy",
  deliverIdentity: { via: "hook-context" },
  moments: { sessionStart: "Start" },
});
```

```
$ harness-harnesser check ./toy.mjs | tail -1
PASS toy: contract 1.0.0, core 7 of 7, optional 35 of 35
```

Then add what your harness really has, one clause at a time. An ability is a `yes` only with the date you measured it, the version you measured it on, and one sentence saying what you observed. [CONTRACT.md](./CONTRACT.md) has every clause and the full rules.

You do not need anyone's permission to try this. The file can live anywhere, and `loadAdapter("./toy.mjs")` reads it.

## Where this came from

It was extracted from the harness resolver inside Freedom. For Claude Code and Codex, every value that resolver returned is returned here unchanged, and the tests that pinned those values there were ported here before the adapters were written.

## License

MIT
