# Changelog

## 0.4.3 (2026-10-26)

- **The default state folder is `~/.supersuit`, never the retired `~/.freedom`.** The pinned Claude Code binary (`CANDIDATES`, `pinnedPath`), the launchd PATH (`launchdPathDirs`) and the default machine config file (`harnessId` without `configFile`) all read `~/.supersuit`, matching Supersuit v7, which keeps `~/.freedom` as a link to the same folder. A host with its own folder still passes `configFile`, as before; `FREEDOM_HARNESS` is unchanged. Tests assert the new path and refuse a `~/.freedom` config that is not the same folder.

## 0.4.2 (2026-10-23)

- **No adapter tells a host to type the retired `freedom:` skill prefix.** The Claude Code profile's `slashCommands` evidence now names `/supersuit:<skill>`, and the Codex one `$supersuit:<skill>`, since both harnesses dropped the `freedom:` alias. A test refuses the old form. Reported in ContinentalWorks/supersuit-dev#929.

## 0.4.1 (2026-10-21)

- **`bin/codex-background.mjs` no longer exits before its one line of JSON has left the process.** `say()` called `process.exit` straight after writing, which can drop the line when stdout is a pipe, and a pipe is how every host reads it. It now exits from the write's callback, and stops the verb where it is so nothing runs after the line is printed. Reported in ContinentalWorks/freedom-dev#720.

## 0.4.0 (2026-10-17)

Standard version 2.2.0. Additions only: both shipped harnesses are still superharnesses, 11 of 11, with the same scorecard.

- **Codex can start a background session that runs on with nobody watching.** Its `startBackground` used to be `codex exec --json`, which blocks until the turn ends, so it was never a background session. It now runs `bin/codex-background.mjs start`, which starts Codex's shared app-server daemon if it is down, starts a named thread in the folder with nobody needed to approve anything, sends the prompt as its first turn, prints one line of JSON with the thread id, and exits while the thread runs on. Measured on codex-cli 0.162.1: a thread whose turn slept 20 seconds and then wrote a file finished the file after the starting program had exited. `codex resume <id>` opens it in a terminal.
- **Three new optional actions finish a background session's life**, so a host can start, find and stop one without knowing which harness it drives: `sessionIdFrom` (read the id out of what starting printed), `listBackground` (the command that lists running sessions, and how to read what it prints, with busy for a session that is working), and `stopBackground`. Claude Code answers with `claude attach`, `claude agents --json` and `claude stop`; Codex with the same bin's `list` and `stop`, which interrupts the turn in progress.
- `src/codex-background.mjs` is the daemon client (start, list, stop, and starting the daemon when its socket is missing), and `src/uds-websocket.mjs` a small dependency-free WebSocket client over a Unix socket, because the daemon's control socket speaks WebSocket and Node's own client cannot dial a Unix socket. Tests drive a fake daemon that speaks the real wire format.

## 0.3.0 (2026-10-13)

Standard version 2.1.0. Additions only: nothing an existing importer reads has changed, and both shipped harnesses are still superharnesses, 11 of 11, with the same scorecard (Claude Code 20.6 of 23, Codex 16.7 of 23).

Added:

- A new entry point, `@supersuit/superharness/places`. It exports `PLACES`, `claudeCodePlaces(env)` and `codexPlaces(env)`: where each shipped harness keeps things, and nothing else. Import it from a program that must not load anything able to start another program, such as a health check that refuses those imports. The main entry point and the `bin-resolver` entry point are unchanged, and the main entry point now exports the same three names.
- Six optional places, answered by both shipped adapters:
  - `projectDir(root)`: the settings folder inside a project. `<root>/.claude` on Claude Code, `<root>/.codex` on Codex.
  - `userInstructionsFile(home)`: the instruction file read at the start of every session. `<configDir>/CLAUDE.md` on Claude Code, `<configDir>/AGENTS.md` on Codex. On Codex it is the same function as `deliverIdentity.file`.
  - `isInsidePluginFolder(path, home)`: true for a path inside a plugin copy. It answers true for every path the test Freedom used before answered true for (a `.claude/plugins/` or `plugins/cache/` folder, with the platform separator), and also for anything inside the harness's own `pluginCacheDir(home)` or `marketplacesDir(home)`.
  - `credentialsFile(home)`: `<configDir>/.credentials.json` on Claude Code, null on Codex.
  - `bridgeSpawnDir(home)`: `<configDir>/bridge-spawn` on Claude Code, null on Codex.
  - `bridgePointerFile(home, cwd)`: `<transcriptsRoot>/<cwd slug>/bridge-pointer.json` on Claude Code, null on Codex and null when an argument is missing.
- `superharness path` answers the five new places that are paths. `projectDir` takes `--root`, and `bridgePointerFile` takes `--cwd`.
- The check has a new kind of clause, a predicate: a place that answers true or false about a path, must return a boolean, and must not throw.

Changed:

- `check` prints six more clause rows, so its count line reads `optional 49 of 49` for both shipped harnesses where it read `43 of 43`.
- The full adapters take every place from the places module, so there is one copy of each path. Every place 0.2.0 answered returns the same string as 0.2.0 for every environment, home, working directory and session id in a recorded matrix, and a test compares against that recording.

What was read, and from where:

- Codex's `projectDir` was read from the program text of codex-cli 0.162.1 on 2026-10-13, which describes a project `.codex/config.toml` as the settings for a trusted repository.
- The three Claude Code files are the paths Freedom builds by hand today, under `configDir` and `transcriptsRoot` here so they follow `CLAUDE_CONFIG_DIR` the way every other place does.

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
