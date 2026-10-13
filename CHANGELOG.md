# Changelog

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
