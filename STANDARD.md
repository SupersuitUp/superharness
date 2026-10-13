# The superharness standard

**Version 2.0.0**

A superharness is a harness you can hand your whole computer and your whole context to, and still be the one in command.

This page is the standard: the eleven boxes a harness must check to be called a superharness, how each box is decided, and how to show that your harness checks them. Claude Code and Codex are the two that check all eleven in this version.

The same standard is in `src/bar.mjs` and `src/contract.mjs` as data. A test fails when this page and those files disagree.

## What a harness is

A harness is the agent loop: the program that takes what you say, lets a model read and write and run things on your machine, and keeps the conversation. Claude Code is one. Codex is one.

A harness is powerful because it acts on your computer with your context. That is also the risk. So the standard asks two things of it, in equal measure: that it can do the work, and that you stay in command while it does.

## The bar

Eleven boxes, in two halves. A harness is a superharness when it checks all eleven. Ten is not a superharness.

### Capability

It can do the work.

1. `computer`: It works on your computer: it reads and writes your files and runs programs in folders you choose.
2. `instructions`: It loads your instructions whole, every session.
3. `skills`: It reads skills from a folder, in the open skill format.
4. `tools`: It can be given new tools through the open connector standard.
5. `unattended`: It can work while you are not watching, from a single command.
6. `helpers`: It can hand work to helper agents.

### Safety

You stay in command.

7. `refuses`: It stops before it acts: there is a moment before every tool runs where a rule can say no.
8. `permission`: It asks permission, and can be restricted to a list of what it may do without asking.
9. `record`: It keeps a full record of every session on your own disk, in a form you can read and take with you.
10. `remoteControl`: You can reach it from your phone: start a session, check on one, answer it.
11. `questionCard`: It can ask you a question as a card with choices.

Remote control is the name for box 10 everywhere a person reads it: you start a session, check on one, and answer it, from your phone.

## How each box is decided

Every box is decided only from what the harness's adapter declares. The check starts no harness and takes nobody's word. The adapter either declares the thing, with evidence where evidence is asked for, or the box is not checked.

| Box | Checked when |
| --- | --- |
| `computer` | `actions.bin` is a function, and `places.configDir` and `places.transcriptsRoot` each return a non-empty string. |
| `instructions` | `actions.deliverIdentity` has `via` set to `hook-context`, or to `file` with a `file` getter. |
| `skills` | `places.skillsDir` returns a non-empty string. |
| `tools` | `abilities.mcp` is an evidenced yes. |
| `unattended` | `abilities.backgroundSession` is an evidenced yes, and `actions.startBackground` is a function. |
| `helpers` | `abilities.subagents` is an evidenced yes. |
| `refuses` | `moments.beforeTool` is named, and `abilities.refuseTool` is an evidenced yes. |
| `permission` | `abilities.permissionGate` is an evidenced yes. |
| `record` | `places.transcriptsRoot` returns a string, and `actions.isTurn` is a function. |
| `remoteControl` | `abilities.phone` is an evidenced yes. The key is `phone` for the code that already reads it; `remoteControl` answers the same. |
| `questionCard` | `abilities.askCard` is an evidenced yes, and `actions.questionCard` is present and well formed. |

### An evidenced yes

Seven boxes rest on an ability. An ability is answered one of three ways:

- `yes`: it was measured, and the answer carries the date (`measured`, as YYYY-MM-DD), the harness version it was measured on (`version`), and one sentence saying what was observed (`evidence`).
- `no`: it was measured, and the answer was no.
- `unmeasured`: nobody has measured it yet.

Only a yes with all three of date, version and evidence checks a box. A yes with any of them missing does not, and it also fails the clause check as malformed. An ability nobody answered reads as `unmeasured`, and code asking `can.<ability>` gets `false`.

The evidence sentence says who observed it. When an answer rests on a person's firsthand report and not on a run this package made, the sentence says so. When it rests on reading a help text and not on a session that was watched, the sentence says that too.

### A well formed question card

`actions.questionCard` says how the harness asks you a question as a card, and how its answer comes back:

```js
questionCard: {
  tools: ["AskUserQuestion"],          // every tool that shows a card, in preference order
  shape: "claude",                     // a name for the input format
  read: (toolInput) => ({ questions: [{ text, options }] }),
  answeredBy: "tool-result",           // or "next-user-message"
}
```

It is well formed when `tools` is a non-empty list of names, `shape` is a non-empty string, `read` is a function that returns `{ questions: [] }` for an input it cannot read and never throws, `answeredBy` is one of the two values, and `answerPolicy`, when given, is a sentence.

`answeredBy` is the half that keeps you in command. With `tool-result`, your choice comes back as the tool's own result. With `next-user-message`, the tool returning only means the card was shown, and nothing counts as your answer until your next message arrives.

An adapter may add `answerPolicy`, one sentence for anything that consumes the card, when `answeredBy` is not enough. Codex's says that only the person's next message is an answer, and that a card which expires, disappears or returns a preselected option is not one. Box 11 asks only that the card can be shown and read. Whether a card waits for you is the separate ability `cardWaits`.

`cardFrom({ tool_name, tool_input }, profile)` reads a card from a tool call. It returns `null` for any tool that is not one of the profile's card tools. A name matches exactly, or after one leading `functions.`.

## The clauses

The boxes are decided from clauses. A clause is one question every adapter answers in the same words. Each is listed here with its id, whether it is core or optional, and the question it asks.

Core means the adapter is malformed without it. Optional means it may be left out. Neither word is the pass line: the pass line is the bar above.

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
- `actions.questionCard` (optional): How the harness asks the person a question as a card: { tools: string[], shape: string, read: (toolInput) => { questions: [{ text, options }] }, answeredBy: 'tool-result' | 'next-user-message', answerPolicy?: string }.
- `actions.pluginManifestDir` (optional): The folder name a plugin's manifest lives in.
- `actions.pluginRootEnv` (optional): The environment variable a hook reads to find its plugin.

### Moments

The points where a harness lets other code step in. Each harness names these differently, so the standard gives them common names and each adapter says which of its own events match. A moment the harness does not have is `null`.

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
- `abilities.refuseTool` (optional): Whether the harness has "refuseTool": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.permissionGate` (optional): Whether the harness has "permissionGate": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.cardWaits` (optional): Whether the harness has "cardWaits": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.followsStanding` (optional): Whether the harness has "followsStanding": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.steersMidTask` (optional): Whether the harness has "steersMidTask": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.takesIdentity` (optional): Whether the harness has "takesIdentity": { answer: yes | no | unmeasured, measured, version, evidence }.
- `abilities.extendsSystemPrompt` (optional): Whether the harness has "extendsSystemPrompt": { answer: yes | no | unmeasured, measured, version, evidence }.

Five abilities are not read by any box. They are rows of the [rubric](./RUBRIC.md), so they tell superharnesses apart without deciding who is one:

- `abilities.cardWaits`: a question card waits for the person as long as it takes, and never answers itself.
- `abilities.followsStanding`: it follows standing instructions without being reminded.
- `abilities.steersMidTask`: it can be redirected while it is working, without being stopped.
- `abilities.takesIdentity`: it becomes who the instruction files say it is.
- `abilities.extendsSystemPrompt`: the instructions it starts from can be added to or replaced, beyond a file in a folder.

Box 2, instructions that load whole, is the floor of harnessability, and the scorecard measures how far above the floor a harness goes.

`abilities.phone` is remote control. Every profile also answers under `abilities.remoteControl` and `can.remoteControl`, with the same answer.

### Vocabulary

Skills are written with one harness's tool names. Instead of rewriting every skill for every harness, each adapter can supply a short note that maps those names onto its own.

- `vocabulary.askOperator` (optional): The name of the tool that asks the person a question as a card, or null.
- `vocabulary.note` (optional): Text given to the model at session start that maps tool names used in skills onto this harness's own, or null.

## How to write an adapter

An adapter is one file. Its default export is a function that takes an environment and returns the harness's answers. Here is a complete one for an imaginary harness named Toy. It declares everything the eleven boxes read.

```js
// toy.mjs
const seen = (evidence) => ({ answer: "yes", measured: "2026-10-13", version: "1.4.2", evidence });

export default (env) => ({
  id: "toy",
  label: "Toy",
  bin: () => "toy",
  configDir: (home) => home + "/.toy",
  skillsDir: (home) => home + "/.toy/skills",
  transcriptsRoot: (home) => home + "/.toy/log",
  deliverIdentity: { via: "hook-context" },
  isTurn: (line) => line?.role === "user" || line?.role === "assistant",
  startBackground: ({ prompt }) => ({ cmd: "toy", args: ["run", prompt] }),
  moments: { sessionStart: "Start", beforeTool: "BeforeTool" },
  questionCard: {
    tools: ["ask"],
    shape: "toy",
    read: (input) => ({
      questions: (Array.isArray(input?.questions) ? input.questions : [])
        .map((q) => ({ text: String(q?.text ?? ""), options: Array.isArray(q?.options) ? q.options : [] })),
    }),
    answeredBy: "tool-result",
  },
  abilities: {
    mcp: seen("One sentence saying what you observed."),
    backgroundSession: seen("One sentence saying what you observed."),
    subagents: seen("One sentence saying what you observed."),
    refuseTool: seen("One sentence saying what you observed."),
    permissionGate: seen("One sentence saying what you observed."),
    phone: seen("One sentence saying what you observed."),
    askCard: seen("One sentence saying what you observed."),
  },
});
```

Four things to know:

- **The environment is an argument.** If your harness honours an environment variable for its config folder, read it from `env`, not from `process.env`.
- **Leave out what you do not have.** An optional clause that is absent passes the clause check as "not provided", and the box that reads it stays unchecked. One that is present and malformed fails.
- **Answer abilities only with what you measured.** The seven sentences above are placeholders. Write each one from something you ran or watched, with the real date and the real version. Until then, leave the ability out and it reads `unmeasured`.
- **Never write a yes to check a box.** A harness that checks ten boxes is reported as ten of eleven, with the missing one named. That is a true and useful answer.

To use it from code:

```js
import { loadAdapter, register, harness, isSuperharness } from "@supersuit/superharness";

register("toy", await loadAdapter("./toy.mjs"));
const toy = harness({ env: { FREEDOM_HARNESS: "toy" }, home: "/Users/you", config: {} });
toy.skillsDir("/Users/you");  // "/Users/you/.toy/skills"
isSuperharness(toy);          // true
```

Nobody's permission is needed to try this. The adapter file can live anywhere.

## How to run the check

```sh
npx @supersuit/superharness check ./toy.mjs
```

It prints one line per clause, `PASS`, `FAIL` or `SKIP`, and a line counting them. Then it prints one line per box, and it ends with one of two lines:

```
SUPERHARNESS toy: 11 of 11 (standard 2.0.0)
NOT A SUPERHARNESS toy: 9 of 11, missing: remoteControl, questionCard
```

It exits 0 for the first and 1 for the second. A harness that checks all eleven boxes but has a malformed clause is also not passed: the last line names the clause, and the exit code is 1. Add `--json` for a result a program can read.

To see only the eleven boxes:

```sh
npx @supersuit/superharness bar ./toy.mjs
```

Both commands read the adapter file and need nothing installed.

## Live check

Some things can only be shown on a machine that has the harness. `check --live` adds those rows.

Two rows run on their own:

- `live.bin`: the program runs with `--version` and exits 0. The version string it printed is recorded.
- `live.configDir`: the config folder exists.

A harness that is not installed is skipped with the reason "harness not installed". It is never failed for being absent.

Three rows need a real session that a person can watch. They are printed as `SKIP` with the reason "needs an interactive probe; see STANDARD.md, Live check", and this package never fills them in by itself:

- `live.session.hookFires`: a hook registered for the session-start moment runs when a session starts.
- `live.session.identityArrives`: an instruction file delivered the way `actions.deliverIdentity` says reaches the model whole. Plant a word in the middle of the file, not only at the end, and ask the model for it.
- `live.session.recordReadable`: after one exchange, the record under `places.transcriptsRoot` holds both turns, and `actions.isTurn` counts exactly two.

Only a live result can turn `unmeasured` into `yes`. A result is recorded as four things:

1. the date
2. the harness version, as the program prints it
3. the command that was run
4. what was observed, in one or two sentences

Those go into the adapter file as the ability's `measured`, `version` and `evidence`. Anyone can run the same command and send a result that changes the answer.

### The probe for `refuseTool`

This is the one box this package measured with a live run of its own, and the recipe is short enough to repeat on any harness:

1. Register a rule for the before-tool moment that logs what it is handed and says no to any command containing one unusual word.
2. Ask the harness, from a single command, to run a shell command that contains the word and would create a file.
3. Look at two things: whether the rule's log holds the call, and whether the file exists.

The rule fired and the file does not exist: yes. The rule fired and the file exists: no. The rule never fired: unmeasured, with a sentence saying what was tried.

On Codex this was run on 2026-10-13 on codex-cli 0.162.1. The rule logged one call, Codex reported the command as blocked, and the file was not created. The full sentence is in the adapter file.

## Versioning

The standard has its own version number, separate from the package's.

- **A new optional clause is a minor version.** Every adapter that passed still passes.
- **A new box, a box whose rule changes, a new core clause, or a clause whose meaning changes is a major version.** A harness that was a superharness may no longer be one.
- **A fix to the wording that changes no meaning is a patch version.**

Version 2.0.0 is the first with a bar. Version 1.0.0 asked six core clauses and called everything else optional.

Before any release, the adapters this package ships must check all eleven boxes. The test suite runs the check.
