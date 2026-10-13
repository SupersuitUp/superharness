# The harness contract

**Version 1.0.0**

This is what an agent harness owes a system built on top of it. A harness that answers the core of this contract can hold the slot. Claude Code and Codex are the two that pass it in this version.

The same contract is in `src/contract.mjs` as data. A test fails when this page and that file disagree.

## What a harness is

A harness is the agent loop: the program that takes what you say, lets a model read and write and run things on your machine, and keeps the conversation. Claude Code is one. Codex is one.

A system built on a harness needs to know a few things about it. Where it keeps its settings and its skills. How to start it. When it will let other code step in. What it can and cannot do. Each harness answers those differently, so this contract asks the same questions of all of them, in the same words.

## The promise

**A harness that passes the core holds the slot.** The core is six clauses: three places, the program itself, how instruction files reach the model, and the moment a session starts.

**Everything else is optional and honestly answered.** A harness can pass without a line to your phone, without background sessions, without helper agents. What it may not do is claim one it has not shown.

An ability is answered one of three ways:

- `yes`: it was measured, and the answer carries the date, the harness version, and one sentence of evidence.
- `no`: it was measured, and the answer was no.
- `unmeasured`: nobody has measured it yet.

A `yes` without a date, a version and evidence fails the check. An ability nobody answered reads as `unmeasured`, and code asking `can.<ability>` gets `false`. So a skill that needs the phone line asks, gets a no, and says so in a sentence. It never runs a command that is not there.

## The five groups

Every clause is listed here with its id, whether it is core or optional, and the question it asks.

### Places

Where the harness keeps things. Each one is a function of the home folder it is given. A place getter never reads the environment or looks up the real home itself, so a test, a background job and a live session all get the same answer. The check enforces this, and reports it as the row `purity`.

- `places.configDir` (core): Where the harness keeps its own settings, given a home folder.
- `places.skillsDir` (core): Where the harness looks for skills.
- `places.transcriptsRoot` (core): The folder under which conversation records are written.
- `places.settingsFile` (optional): The settings file a person edits.
- `places.pluginCacheDir` (optional): Where installed plugins are cached.
- `places.marketplacesDir` (optional): Where plugin catalogs are cached.
- `places.sessionsDir` (optional): Where live sessions are registered. Returns null when there is no registry.
- `places.transcriptPath` (optional): The record for one session, when it can be computed. Returns null when it must be searched for.
- `places.worktreesDir` (optional): Where working copies of a project are parked.

`transcriptPath` is called with a home, a working directory and a session id. `worktreesDir` is called with a project folder.

### Actions

What a system asks the harness to do.

- `actions.bin` (core): Finds the harness's own program on this machine.
- `actions.deliverIdentity` (core): How instruction files reach the model: { via: 'hook-context' | 'file', file?: (home) => path, maxChars?: number }.
- `actions.isTurn` (optional): True for a record line that is something a person or the model said.
- `actions.startBackground` (optional): The command that starts a session nobody is watching: ({ prompt, name, cwd }) => { cmd, args }. Null when the harness cannot.
- `actions.runPrompt` (optional): The command that runs one prompt and returns: ({ prompt, cwd }) => { cmd, args }.
- `actions.pluginManifestDir` (optional): The folder name a plugin's manifest lives in.
- `actions.pluginRootEnv` (optional): The environment variable a hook reads to find its plugin.

### Moments

The points where a harness lets other code step in. Each harness names these differently, so the contract gives them common names and each adapter says which of its own events match. A moment the harness does not have is `null`.

- `moments.sessionStart` (core): The harness's own event name for "sessionStart", or null when it has none.
- `moments.sessionEnd` (optional): The harness's own event name for "sessionEnd", or null when it has none.
- `moments.promptSubmitted` (optional): The harness's own event name for "promptSubmitted", or null when it has none.
- `moments.beforeTool` (optional): The harness's own event name for "beforeTool", or null when it has none.
- `moments.afterTool` (optional): The harness's own event name for "afterTool", or null when it has none.
- `moments.toolFailed` (optional): The harness's own event name for "toolFailed", or null when it has none.
- `moments.permissionRequest` (optional): The harness's own event name for "permissionRequest", or null when it has none.
- `moments.beforeCompact` (optional): The harness's own event name for "beforeCompact", or null when it has none.
- `moments.afterCompact` (optional): The harness's own event name for "afterCompact", or null when it has none.
- `moments.subagentStart` (optional): The harness's own event name for "subagentStart", or null when it has none.
- `moments.subagentStop` (optional): The harness's own event name for "subagentStop", or null when it has none.
- `moments.stop` (optional): The harness's own event name for "stop", or null when it has none.
- `moments.interrupt` (optional): The harness's own event name for "interrupt", or null when it has none.
- `moments.notification` (optional): The harness's own event name for "notification", or null when it has none.

### Abilities

Things a harness may or may not have. Each is answered `yes`, `no` or `unmeasured`, as described above.

- `abilities.phone` (optional): Whether the harness has "phone": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.backgroundSession` (optional): Whether the harness has "backgroundSession": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.pluginHooks` (optional): Whether the harness has "pluginHooks": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.slashCommands` (optional): Whether the harness has "slashCommands": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.subagents` (optional): Whether the harness has "subagents": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.mcp` (optional): Whether the harness has "mcp": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.liveSessionRegistry` (optional): Whether the harness has "liveSessionRegistry": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.liveSessions` (optional): Whether the harness has "liveSessions": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.askCard` (optional): Whether the harness has "askCard": { answer: yes | no | unmeasured, measured, version, evidence }.

### Vocabulary

Skills are written with one harness's tool names. Instead of rewriting every skill for every harness, each adapter can supply a short note that maps those names onto its own.

- `vocabulary.askOperator` (optional): The name of the tool that asks the person a question as a card, or null.
- `vocabulary.note` (optional): Text given to the model at session start that maps tool names used in skills onto this harness's own, or null.

## How to write an adapter

An adapter is one file. Its default export is a function that takes an environment and returns the harness's answers. Here is a complete one for an imaginary harness named Toy. It answers the six core clauses and nothing else, and it passes.

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

Three things to know:

- **The environment is an argument.** If your harness honours an environment variable for its config folder, read it from `env`, not from `process.env`.
- **Leave out what you do not have.** An optional clause that is absent passes as "not provided". One that is present and malformed fails.
- **Answer abilities only with what you measured.** Add `abilities: { phone: { answer: "yes", measured: "2026-10-13", version: "1.4.2", evidence: "One sentence saying what you observed." } }` when you have observed it. Until then, leave it out and it reads `unmeasured`.

To use it from code:

```js
import { loadAdapter, register, harness } from "@supersuit/harness-harnesser";

register("toy", await loadAdapter("./toy.mjs"));
harness({ env: { FREEDOM_HARNESS: "toy" }, home: "/Users/you", config: {} }).skillsDir("/Users/you");
// "/Users/you/.toy/skills"
```

Nobody's permission is needed to try this. The adapter file can live anywhere.

## How to run the check

```sh
npx @supersuit/harness-harnesser check ./toy.mjs
```

It prints one line per clause, `PASS`, `FAIL` or `SKIP`, and then a summary line. It exits 0 when every core clause passes and nothing is malformed, and 1 otherwise. Add `--json` for a result a program can read.

This half reads the adapter file and needs nothing installed.

## Live check

Some things can only be shown on a machine that has the harness. `check --live` adds those rows.

Two rows run on their own:

- `live.bin`: the program runs with `--version` and exits 0. The version string it printed is recorded.
- `live.configDir`: the config folder exists.

A harness that is not installed is skipped with the reason "harness not installed". It is never failed for being absent.

Three rows need a real session that a person can watch. They are printed as `SKIP` with the reason "needs an interactive probe; see CONTRACT.md, Live check", and this package never fills them in by itself:

- `live.session.hookFires`: a hook registered for the session-start moment runs when a session starts.
- `live.session.identityArrives`: an instruction file delivered the way `actions.deliverIdentity` says reaches the model whole. Plant a word in the middle of the file, not only at the end, and ask the model for it.
- `live.session.recordReadable`: after one exchange, the record under `places.transcriptsRoot` holds both turns, and `actions.isTurn` counts exactly two.

Only a live result can turn `unmeasured` into `yes`. A result is recorded as four things:

1. the date
2. the harness version, as the program prints it
3. the command that was run
4. what was observed, in one or two sentences

Those go into the adapter file as the ability's `measured`, `version` and `evidence`. Anyone can run the same command and send a result that changes the answer.

## Versioning

The contract has its own version number, separate from the package's.

- **A new optional clause is a minor version.** Every adapter that passed still passes.
- **A new core clause, or a clause whose meaning changes, is a major version.** An adapter that passed may no longer pass.
- **A fix to the wording that changes no meaning is a patch version.**

Before any release, the adapters this package ships must pass the check. The test suite runs it.
