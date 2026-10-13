# Changelog

## 0.2.0

The package is renamed, and its promise changes. It was `@supersuit/harness-harnesser`, a contract any harness could pass. It is now `@supersuit/superharness`, the superharness standard: a harness is a superharness when it checks eleven stated boxes.

Standard version 2.0.0. This is a major version of the standard, because a harness that passed 1.0.0 with six core clauses is not thereby a superharness.

Renamed:

- The package is `@supersuit/superharness`, the command is `superharness`, and the repository is `SupersuitUp/superharness`.
- `CONTRACT.md` is `STANDARD.md`, titled "The superharness standard".
- `STANDARD_VERSION` is the version export. `CONTRACT_VERSION` is still exported and equals it.
- `phoneLineWarning` is `remoteControlWarning`, and its three lines say remote control. The old name is still exported and is the same function.

Added:

- The bar, as data: `BAR`, eleven boxes in two halves (capability and safety), each with the sentence a person reads and the clauses it is decided from. `DEFINITION` is the one sentence.
- `checkBar(profile)` and `isSuperharness(profile)`. Every box is decided only from what the adapter declares. A box that rests on an ability needs a yes with a date, a version and an evidence sentence.
- Three abilities, `refuseTool`, `permissionGate` and `cardWaits`, after the original nine. `cardWaits` means a question card waits for the person as long as it takes and never answers itself. It is not a box of the bar.
- A scorecard row for it, weight 2: "A question waits for me as long as it takes". The maximum is now 16.
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
- Both shipped harnesses check all eleven boxes. On the scorecard Claude Code is 15.6 of 16 and Codex is 13.7 of 16. The two points are the `cardWaits` row; on the moments row Codex names 12 against 11.
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
