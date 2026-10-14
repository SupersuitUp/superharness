# Changelog

## 0.2.0

The package is renamed, and its promise changes. It was `@supersuit/harness-harnesser`, a contract any harness could pass. It is now `@supersuit/superharness`, the superharness standard: a harness is a superharness when it checks eleven stated boxes.

Standard version 2.0.0. This is a major version of the standard, because a harness that passed 1.0.0 with six core clauses is not thereby a superharness.

Renamed:

- `standing(profile)`: strongly recommended, supported, or not a superharness, read off the scorecard. A superharness with no measured no is strongly recommended; one with any is supported and the shortfalls are named. `superharness rubric` prints it first.
- The package is `@supersuit/superharness`, the command is `superharness`, and the repository is `SupersuitUp/superharness`.
- `CONTRACT.md` is `STANDARD.md`, titled "The superharness standard".
- `STANDARD_VERSION` is the version export. `CONTRACT_VERSION` is still exported and equals it.
- `phoneLineWarning` is `remoteControlWarning`, and its three lines say remote control. The old name is still exported and is the same function.

Added:

- The bar, as data: `BAR`, eleven boxes in two halves (capability and safety), each with the sentence a person reads and the clauses it is decided from. `DEFINITION` is the one sentence.
- `checkBar(profile)` and `isSuperharness(profile)`. Every box is decided only from what the adapter declares. A box that rests on an ability needs a yes with a date, a version and an evidence sentence.
- Seven abilities after the original nine. Two are read by the bar: `refuseTool` and `permissionGate`. Five are read only by the scorecard: `cardWaits`, `followsStanding`, `steersMidTask`, `takesIdentity` and `extendsSystemPrompt`.
- Five scorecard rows, one for each of those five. The maximum is now 23.
- Two named qualities beside reach: moldability (how far your own context reshapes a harness before you say anything) and steerability (how well you can turn it while it works). Every scorecard row has a `quality`, `moldability`, `steerability` or `reach`, `scoreHarness()` returns a subtotal for each in `qualities`, and `rubric` prints them. `RUBRIC.md` says how to produce a result for each moldability row.
- One action clause, `questionCard`: which tools show a card, how a card is read, and what counts as the answer (`tool-result` or `next-user-message`), with an optional `answerPolicy` sentence. Codex's says a card that expires, disappears or returns a preselected option is not an answer. `cardFrom({ tool_name, tool_input }, profile)` reads one from a tool call.
- `remoteControl` as a second name for the `phone` ability, on `can` and on `abilities`. The key `phone` is unchanged.
- The `bar` command, which prints only the eleven boxes.

Changed:

- `check` prints the clauses and a line counting them, then one line per box, and ends with `SUPERHARNESS <id>: 11 of 11 (standard 2.0.0)` or `NOT A SUPERHARNESS <id>: <n> of 11, missing: <ids>`. It exits 0 only for a superharness. Before, it exited 0 for any adapter with six core clauses.
- `summarize()` returns `superharness` and `bar: { ok, total, missing }` beside `pass`. `checkStatic()` returns one row per box (`bar.<id>`, level `bar`) after the clauses.
- `rubric` starts with whether each harness is a superharness. `scoreHarness()` returns `superharness` and `bar`.
- `recommend()` picks only a superharness. A harness that misses a box ranks below every superharness, whatever it scores.
- `check --json` and `rubric --json` carry `standard`. The `contract` key is kept with the same value.

What was measured, on what version and date:

- Codex remote control: yes, 2026-10-13, codex-cli 0.162.1. `codex remote-control --help` offers start, stop and pair, and the operator reports reaching Codex sessions from his phone. This rests on his firsthand report; this package did not start remote control. It was "unmeasured" in 0.1.x because `codex features list` on 0.156.0 printed `remote_control removed`, which was misread as the feature being gone.
- Codex question card: yes, 2026-10-13, codex-cli 0.162.1, on the operator's firsthand report that Codex shows native question cards. Freedom's reference file routes questions to `request_user_input_async`.
- Codex helper agents: yes, 2026-10-13, codex-cli 0.162.1, on the operator's firsthand report. The binary lists SubagentStart and SubagentStop, and `codex features list` shows multi_agent as stable and on.
- Codex `refuseTool`: yes, 2026-10-13, codex-cli 0.162.1, measured by this package with one live `codex exec` run in an isolated CODEX_HOME. A PreToolUse hook received the call for `echo SUPERHARNESS_PROBE > probe.txt` and replied deny, Codex logged the command as blocked by the hook, and probe.txt was not created. Hook trust was bypassed by flag for that run.
- Codex `permissionGate`: yes, 2026-09-23, 0.156.0, from Freedom's test notes: a `codex exec` run with approval policy "never" refused an MCP tool call, and the same call went through once the tool's approval mode was set to approve. The sandbox and approval flags were read from the help text of codex-cli 0.162.1 on 2026-10-13.
- Claude Code `refuseTool`: yes, 2026-10-13, 2.1.296. Freedom's hooks deny tool calls through PreToolUse, and a PreToolUse hook blocked a command in the session that built this version.
- Claude Code `permissionGate`: yes, 2026-10-13, 2.1.296, read from `claude --help`: `--permission-mode`, `--allowedTools` and `--disallowedTools`. This is the help text, not a session that was watched refusing.
- Codex `cardWaits`: no, 2026-10-13, codex-cli 0.162.1. openai/codex issue 28969, first reported on codex-cli 0.141.0 and still open that day, reports that Codex accepts the recommended answer to a question by itself within 60 seconds, and the operator reports the same from his own use. This package did not re-time it on the installed version.
- Claude Code `cardWaits`: yes, 2026-10-13, 2.1.296, read from the program's settings text: `askUserQuestionTimeout` has the choices 60s, 5m, 10m and never, and is described as defaulting to never. Not timed on a session.
- Codex `followsStanding`: no, 2026-09-23, 0.156.0, from Freedom's test notes: in three `codex exec` runs the model asked in plain chat and never used the tool its instructions named, and used it only when the prompt named it. The operator reported the same on 2026-10-13. Not rerun on the installed version. Claude Code: not measured, because the same protocol has not been run on it.
- `steersMidTask`: Claude Code yes, 2026-10-13, 2.1.296: messages sent while the agent was mid-turn were delivered inside the running turn and acted on. Codex no, 2026-10-13, codex-cli 0.162.1, on the operator's firsthand report; no timed test was run.
- `takesIdentity`: Codex yes, 2026-09-23, 0.156.0, from Freedom's test notes. Claude Code yes, 2026-10-13, 2.1.296, on the commissioning session's report.
- `extendsSystemPrompt`: Claude Code yes, read from `claude --help` (`--append-system-prompt`, `--system-prompt`). Codex yes, read from its help (`-c, --config`) and its program text (the config keys `developer_instructions` and `model_instructions_file`); its help lists no flag that names the instructions. Neither was exercised on a session.
- Both shipped harnesses check all eleven boxes. On the scorecard Claude Code is 20.6 of 23 (moldability 6.6 of 9, steerability 2 of 2, reach 12 of 12) and Codex is 16.7 of 23 (moldability 6.7 of 9, steerability 0 of 2, reach 10 of 12).
- The three session-level live rows (`live.session.*`) are still not filled in by this package for either harness.

## 0.1.1

- `SYSTEM_CLAUDE_PATHS` is exported from the `bin-resolver` entry point: the two places a package manager puts `claude` (`/opt/homebrew/bin/claude`, `/usr/local/bin/claude`), named once. `CANDIDATES` ends on it and returns the same list as before. Freedom added this name to its own resolver in v6.29.1, after 0.1.0 was extracted, and four of its callers import it.

Contract version 1.0.0, unchanged.

## 0.1.0

First release, extracted from the harness resolver inside Freedom (v6.29.0).

Contract version 1.0.0.

- The contract as data (`src/contract.mjs`) and as a page (`CONTRACT.md`): 41 clauses in five groups (places, actions, moments, abilities, vocabulary), six of them core.
- Adapters for Claude Code and Codex. Every value Freedom's resolver returned for either one is returned unchanged, and the tests that pinned those values were ported before the adapters were written.
- `defineHarness`, `loadAdapter` and `register`, so a third harness is one file that can live anywhere.
- The conformance check: `checkStatic` needs nothing installed, `checkLive` runs the harness's program with `--version` and declares the session-level rows without filling them in.
- The rubric: a harness scorecard, a model scorecard that ships with no results, `recommend`, and `phoneLineWarning`. `RUBRIC.md` has the weights and the protocol for every model task.
- The `harness-harnesser` command: `list`, `which`, `path`, `can`, `check`, `rubric`, `warn`.

What was measured, and what was not, on the day of this release:

- Claude Code abilities were measured on 2026-10-13 on version 2.1.296.
- Codex abilities carry the dates and the version (0.156.0) from Freedom's own records. Its phone line, its plugin hooks and its question card are not measured. Its helper agents answer rests on reading the program's event list and has not been observed on a session that ran.
- No session-level live probe has been run by this package for either harness.
