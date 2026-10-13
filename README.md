# @supersuit/superharness

A superharness is a harness you can hand your whole computer and your whole context to, and still be the one in command. A harness earns the name by checking eleven boxes: six that say it can do the work, and five that say you stay in command while it does. This package is that standard, the check for it, and the adapters for the two harnesses that check all eleven today, Claude Code and Codex.

Zero dependencies. Node 20 or later.

- [STANDARD.md](./STANDARD.md): the eleven boxes, how each is decided, and how to write an adapter.
- [RUBRIC.md](./RUBRIC.md): how superharnesses are compared, and the protocol for every model task.

## The bar

```
$ superharness bar codex
PASS  computer       capability  It works on your computer: it reads and writes your files and runs programs in folders you choose.
PASS  instructions   capability  It loads your instructions whole, every session.
PASS  skills         capability  It reads skills from a folder, in the open skill format.
PASS  tools          capability  It can be given new tools through the open connector standard.
PASS  unattended     capability  It can work while you are not watching, from a single command.
PASS  helpers        capability  It can hand work to helper agents.
PASS  refuses        safety      It stops before it acts: there is a moment before every tool runs where a rule can say no.
PASS  permission     safety      It asks permission, and can be restricted to a list of what it may do without asking.
PASS  record         safety      It keeps a full record of every session on your own disk, in a form you can read and take with you.
PASS  remoteControl  safety      You can reach it from your phone: start a session, check on one, answer it.
PASS  questionCard   safety      It can ask you a question as a card with choices.
```

Every box is decided from what the harness's adapter declares, and a box that rests on an ability needs the date it was measured, the version it was measured on, and one sentence saying what was observed.

## Install

```sh
npm install @supersuit/superharness
```

Or run it without installing:

```sh
npx @supersuit/superharness list
```

## The commands

Every command is text in, text out. Exit codes: 0 for ok or yes, 1 for no or failed, 2 for a usage error. Add `--json` to `list`, `which`, `check`, `bar` and `rubric` for output a program can read.

### `superharness list`

The harnesses this package ships an adapter for.

```
$ superharness list
claude-code	Claude Code
codex	Codex
```

### `superharness which`

The harness this machine is set to. The `FREEDOM_HARNESS` environment variable wins, then `harness` in `~/.freedom/config.json`, then `claude-code`. An unknown name falls back to `claude-code` and never fails.

```
$ superharness which
claude-code
$ FREEDOM_HARNESS=codex superharness which
codex
```

### `superharness path`

One path and nothing else, so a shell script can use it directly. It exits 1 when the harness has no such place.

```
$ superharness path skillsDir --harness codex --home /Users/you
/Users/you/.codex/skills
$ superharness path transcriptPath --harness claude-code --home /Users/you --cwd /a/b --session s1
/Users/you/.claude/projects/-a-b/s1.jsonl
$ superharness path sessionsDir --harness codex; echo "exit $?"
exit 1
```

Places: `configDir`, `skillsDir`, `transcriptsRoot`, `settingsFile`, `pluginCacheDir`, `marketplacesDir`, `sessionsDir`, `transcriptPath`, `worktreesDir`. Without `--harness` it uses the one `which` reports. Without `--home` it uses your home folder. `worktreesDir` takes `--root <project folder>`.

### `superharness can`

Prints `yes`, `no` or `unmeasured`. It exits 0 only for `yes`. Remote control answers under two names, `remoteControl` and the older `phone`.

```
$ superharness can remoteControl --harness codex; echo "exit $?"
yes
exit 0
$ superharness can pluginHooks --harness codex; echo "exit $?"
unmeasured
exit 1
```

### `superharness check`

One line per clause of the standard and a line counting them, then one line per box, then the answer. The target is a shipped id or the path to an adapter file. It exits 0 only for a superharness.

```
$ superharness check codex | tail -14
PASS  purity                         core      no place getter reads process.env
clauses: core 7 of 7, optional 43 of 43
PASS  computer       capability  It works on your computer: it reads and writes your files and runs programs in folders you choose.
PASS  instructions   capability  It loads your instructions whole, every session.
PASS  skills         capability  It reads skills from a folder, in the open skill format.
PASS  tools          capability  It can be given new tools through the open connector standard.
PASS  unattended     capability  It can work while you are not watching, from a single command.
PASS  helpers        capability  It can hand work to helper agents.
PASS  refuses        safety      It stops before it acts: there is a moment before every tool runs where a rule can say no.
PASS  permission     safety      It asks permission, and can be restricted to a list of what it may do without asking.
PASS  record         safety      It keeps a full record of every session on your own disk, in a form you can read and take with you.
PASS  remoteControl  safety      You can reach it from your phone: start a session, check on one, answer it.
PASS  questionCard   safety      It can ask you a question as a card with choices.
SUPERHARNESS codex: 11 of 11 (standard 2.0.0)
```

A harness that misses a box is told which, and why:

```
$ superharness check ./small.mjs | tail -3; echo "exit $?"
FAIL  remoteControl  safety      You can reach it from your phone: start a session, check on one, answer it. Missing: remote control is not measured.
FAIL  questionCard   safety      It can ask you a question as a card with choices. Missing: askCard is not measured.
NOT A SUPERHARNESS small: 3 of 11, missing: tools, unattended, helpers, refuses, permission, record, remoteControl, questionCard
exit 1
```

`--live` adds the rows that need the harness installed on this machine. It runs the harness's program with `--version` and nothing else. A harness that is not installed is skipped, never failed. The rows that need a real session are printed as `SKIP`; see [STANDARD.md, Live check](./STANDARD.md#live-check).

```
$ superharness check codex --live | grep live
PASS  abilities.liveSessionRegistry  optional  no
PASS  abilities.liveSessions         optional  yes, measured 2026-09-23 on 0.156.0
PASS  live.bin                       optional  codex --version printed codex-cli 0.162.1
PASS  live.configDir                 optional  /Users/you/.codex exists
SKIP  live.session.hookFires         optional  needs an interactive probe; see STANDARD.md, Live check
SKIP  live.session.identityArrives   optional  needs an interactive probe; see STANDARD.md, Live check
SKIP  live.session.recordReadable    optional  needs an interactive probe; see STANDARD.md, Live check
```

### `superharness bar`

Only the eleven boxes, as shown at the top of this page. It exits 0 only when all eleven are checked.

```
$ superharness bar claude-code | tail -2; echo "exit $?"
PASS  remoteControl  safety      You can reach it from your phone: start a session, check on one, answer it.
PASS  questionCard   safety      It can ask you a question as a card with choices.
exit 0
```

### `superharness rubric`

Whether each harness is a superharness, then the scorecard for each, with a subtotal for its three qualities (reach; moldability, how far your own context reshapes it before you say anything; and steerability, how well you can turn it while it works) and the date, the version and the evidence behind every row. With `--needs`, the last line is the recommendation. It exits 1 when you named a need and no superharness meets it.

```
$ superharness rubric --needs liveSessionRegistry
Claude Code: superharness, 11 of 11 (standard 2.0.0)
Codex: superharness, 11 of 11 (standard 2.0.0)

Claude Code  20.6 of 23
  moldability 6.6 of 9, steerability 2 of 2, reach 12 of 12
    3 of 3  I can reach it by remote control from my phone: yes, measured 2026-10-13 on 2.1.296 (Claude Code)
            `claude --help` on this version lists `--remote-control`, and the com.getfreedom.remotecontrol LaunchAgent that runs `claude remote-control` was loaded on the measuring Mac.
    2 of 2  It can work while I am not watching: yes, measured 2026-10-13 on 2.1.296 (Claude Code)
  ...

Codex  16.7 of 23
  moldability 6.7 of 9, steerability 0 of 2, reach 10 of 12
    3 of 3  I can reach it by remote control from my phone: yes, measured 2026-10-13 on codex-cli 0.162.1
  ...
    0 of 2  A question waits for me as long as it takes: no, measured 2026-10-13 on codex-cli 0.162.1
  ...
  1.7 of 2  My rules run at every moment, not only some: 12 of 14
            The adapter names 12 of the standard's 14 moments.
  ...

No model results ship with this package. A model scorecard is filled by a recorded run; see RUBRIC.md.

Claude Code, because you need a registry of running sessions and it is the only one of the 2 superharnesses scored with that measured today (a registry of running sessions: measured 2026-10-13 on 2.1.296 (Claude Code)).
```

The `...` lines stand for the remaining rows and evidence sentences, which the real command prints in full.

### `superharness warn`

The text to show someone before they set up inside a harness with no remote control measured. It prints nothing for a harness that has it, which today is both shipped harnesses.

```
$ superharness warn ./small.mjs
Without remote control you cannot reach Small from your phone: you will not be able to start a session, check on one that is running, or answer a question it asks.
Whether Small has remote control: not measured yet. Remote control is measured today for Claude Code and Codex.
You can continue anyway.
$ superharness warn codex
```

### `superharness --help`

Prints every command with its options. `superharness --version` prints the package version and the standard version:

```
$ superharness --version
0.2.0 (standard 2.0.0)
```

## The library

```js
import {
  harness, harnessId, loadAdapter, register,
  BAR, checkBar, isSuperharness, cardFrom,
  checkStatic, checkLive, summarize,
  scoreHarness, recommend, remoteControlWarning,
  STANDARD_VERSION, CLAUSES, ABILITIES, MOMENTS,
} from "@supersuit/superharness";

// The profile for this machine. Every path on it is a function of the home you pass.
const h = harness({ env: process.env, home: "/Users/you" });
h.id;                       // "claude-code"
h.skillsDir("/Users/you");  // "/Users/you/.claude/skills"
h.moments.toolFailed;       // "PostToolUseFailure", or null on a harness that has no such event
h.can.remoteControl;        // true only for a measured yes. h.can.phone is the same answer
h.abilities.remoteControl;  // { answer, measured, version, evidence }

// Is it a superharness?
isSuperharness(h);          // true
checkBar(h);                // 11 rows: { id, half, ok, why }
summarize(checkStatic(h));
// { pass: true, core: { ok: 7, total: 7 }, optional: { ok: 43, total: 43 }, failed: [],
//   superharness: true, bar: { ok: 11, total: 11, missing: [] } }

// Is this tool call a question card, and what does it ask?
cardFrom({ tool_name: "AskUserQuestion", tool_input }, h);  // { questions: [{ text, options }] }, or null
h.questionCard.answeredBy;                                  // "tool-result"
h.can.cardWaits;                                            // does a card wait for you, or answer itself?

// Which superharness for someone who needs a registry of running sessions?
const codex = (await loadAdapter("codex"))({});
recommend({ needs: ["liveSessionRegistry"] }, [h, codex]).because;
```

| Export | What it is |
| --- | --- |
| `DEFINITION`, `BAR` | The one sentence, and the eleven boxes: `{ id, half, says, needs }` |
| `checkBar(profile)`, `isSuperharness(profile)` | One row per box, `{ id, half, ok, why }`, and whether all eleven are checked |
| `cardFrom({ tool_name, tool_input }, profile)` | The question card a tool call shows, `{ questions }`, or `null` when the tool is not one of the profile's card tools |
| `cardReader(pick)`, `questionCardProblem(clause)` | A `read` that cannot throw, built from a function over one question; and what is wrong with a question card clause, or `null` |
| `STANDARD_VERSION`, `CLAUSES`, `ABILITIES`, `MOMENTS` | The clauses the boxes are decided from. `CONTRACT_VERSION` is still exported and equals `STANDARD_VERSION` |
| `defineHarness(spec)` | Turns an adapter's answers into a full profile: every ability answered, every moment named or null, `events`, and `can` |
| `BUILTIN`, `HARNESSES`, `PROFILES`, `DEFAULT_HARNESS` | The shipped adapters, their ids, a built profile of each, and `"claude-code"` |
| `loadAdapter(pathOrId)` | An adapter factory from a shipped id or a file. Async |
| `register(id, factory)` | Makes an outside adapter resolvable by id |
| `harnessId(opts)`, `harness(opts)`, `isSwapped(opts)`, `installed(profile, home)` | The resolver. `opts` is `{ env, home, config, envVar, configFile }`; `envVar` defaults to `FREEDOM_HARNESS` and `configFile` to `(home) => home/.freedom/config.json`, so another product can use its own names |
| `checkStatic(profile)`, `checkLive(profile, opts)`, `summarize(results)` | The check. `summarize` returns `pass` for the clauses and `superharness` and `bar` for the boxes |
| `HARNESS_ROWS`, `QUALITIES`, `MOLDABILITY`, `STEERABILITY`, `scoreHarness(profile)` | The harness scorecard. Every row has a `quality`, and the card starts with `superharness` and `bar` and carries a subtotal per quality in `qualities` |
| `MODEL_ROWS`, `MODEL_RESULTS`, `scoreModel(results)` | The model scorecard. `MODEL_RESULTS` is empty: a model scorecard is filled only by a recorded run |
| `recommend({ needs }, profiles)` | `{ pick, because, ranked }`. Only a superharness is ever picked |
| `remoteControlWarning(profile, { profiles })` | Three lines, or `null` when remote control is measured. `phoneLineWarning` is still exported and is the same function |
| `slugCwd(cwd)`, `isCodexTurn(line)` | Two helpers the adapters use, exported by name |

The program finder the Claude Code adapter uses is a separate entry point:

```js
import { claudeBin, claudeInstalls } from "@supersuit/superharness/bin-resolver";
```

## Add your harness

An adapter is one file, and it can live anywhere. Start with what every adapter must say, and run the check to see which boxes are left:

```js
// small.mjs
export default (env) => ({
  id: "small",
  label: "Small",
  configDir: (home) => home + "/.small",
  skillsDir: (home) => home + "/.small/skills",
  transcriptsRoot: (home) => home + "/.small/log",
  bin: () => "small",
  deliverIdentity: { via: "hook-context" },
  moments: { sessionStart: "Start" },
});
```

```
$ superharness check ./small.mjs | tail -1
NOT A SUPERHARNESS small: 3 of 11, missing: tools, unattended, helpers, refuses, permission, record, remoteControl, questionCard
```

Then check the boxes your harness really checks, one at a time. A box that rests on an ability is a `yes` only with the date you measured it, the version you measured it on, and one sentence saying what you observed. [STANDARD.md](./STANDARD.md) has a complete adapter that checks all eleven, the rule for every box, and a short probe you can run for the hardest one to show, a rule that says no to a tool.

A harness that checks ten boxes is reported as ten of eleven, with the missing one named. Nobody's permission is needed to try this, and `loadAdapter("./small.mjs")` reads the file from code.

## What was measured

Every answer in the two shipped adapters carries its date, its version and its evidence sentence, and `superharness rubric` and `superharness check` print them. Three of Codex's answers (remote control, the question card, helper agents) rest on the operator's firsthand report of 2026-10-13, and each sentence says so. One, a rule that says no to a tool on Codex, was measured by this package with a single live run that day on codex-cli 0.162.1: the rule fired, Codex reported the command blocked, and the file the command would have made was not created.

Both check all eleven boxes, and the scorecard still tells them apart: Claude Code totals 20.6 of 23 and Codex 16.7. Three rows make the difference. A question card on Codex has been reported to answer itself on a timer (openai/codex issue 28969, open on 2026-10-13, and the operator's own report). Codex did not use the tool its standing instructions named in Freedom's test runs of 2026-09-23 on 0.156.0. And the operator reports that a working Codex session is harder to redirect. None of the three was rerun or timed by this package on the installed version, the middle one has not been run on Claude Code at all, and every evidence sentence says so. [RUBRIC.md](./RUBRIC.md) has the protocol for each, so anyone can produce a result that changes a row.

## Where this came from

It was extracted from the harness resolver inside Freedom, and was first published as a contract any harness could pass with six core clauses. Version 0.2.0 turned that into a bar. For Claude Code and Codex, every path and name that resolver returned is returned here unchanged, and the tests that pinned those values there were ported here before the adapters were written.

## License

MIT
