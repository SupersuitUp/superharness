// Codex's answers to the superharness standard.
//
// THE SAFETY PROPERTY is the same as the Claude Code adapter's: every key Freedom's own Codex
// profile had (freedom-harness.mjs, October 2026) returns the same string here.
//
// WHAT IS MEASURED AND WHAT IS NOT. The places, the manifest folder, the hook variable and the
// event list were read out of the shipped 0.156.0 binary on 2026-09-22. Each ability below says
// what was observed, on which version, on which date, and who observed it. Three answers rest on
// the operator's firsthand report of 2026-10-13 and say so in the sentence. One, refuseTool, was
// measured by this package with a single live run. Where nothing was observed, the answer is
// "unmeasured", which scores nothing and is never shown as a no.
//
// Every place comes from src/places.mjs, the module a host can import on its own as
// @supersuit/superharness/places, and the identity file below is that module's
// userInstructionsFile, the same function.
import { cardReader } from "../card.mjs";
import { defineHarness } from "../define.mjs";
import { codexPlaces } from "../places.mjs";
import { fileURLToPath } from "node:url";

/** The bin a host runs to start, list and stop Codex background sessions. */
export const CODEX_BACKGROUND = fileURLToPath(new URL("../../bin/codex-background.mjs", import.meta.url));

/** An env var that is set but blank is unset, which is what every call site's `.trim()` means. */
const envDir = (env, name) => {
  const v = env?.[name];
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/** A Codex typed turn. Exported so a transcript reader can import it without the whole adapter. */
export const isCodexTurn = (o) =>
  o?.type === "event_msg" && (
    o.payload?.type === "user_message" || o.payload?.type === "agent_message" ||
    // Codex 0.156+: every item arrives as item_completed, named by item.type.
    (o.payload?.type === "item_completed" &&
      (o.payload.item?.type === "UserMessage" || o.payload.item?.type === "AgentMessage")));

const yes = (measured, version, evidence) => ({ answer: "yes", measured, version, evidence });

// What `codex --version` printed on the maintainer's Mac on 2026-10-13.
const TODAY = "2026-10-13";
const VERSION = "codex-cli 0.162.1";

export default (env = {}) => {
  const places = codexPlaces(env);
  return defineHarness({
    id: "codex",
    label: "Codex",
    bin: () => envDir(env, "FREEDOM_CODEX_BIN") || "codex",
    // Honours CODEX_HOME. sessionsDir and transcriptPath are null on Codex; places.mjs says why.
    ...places,
    // The typed turn is the event_msg, NOT the response_item with role "user": Codex writes
    // those for context nobody typed (its injected AGENTS.md, <environment_context>,
    // <turn_aborted>). Measured on nine real rollouts.
    isTurn: isCodexTurn,
    // Measured in the 0.156.0 binary: it reads `.claude-plugin/plugin.json` alongside its own
    // manifest folder, and its hook environment table carries CLAUDE_PLUGIN_ROOT alongside
    // PLUGIN_ROOT. So one manifest and one variable serve both harnesses.
    pluginManifestDir: ".claude-plugin",
    pluginRootEnv: "CLAUDE_PLUGIN_ROOT",
    // Codex's own list, in the origin's order.
    events: [
      "SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse",
      "PermissionRequest", "PreCompact", "PostCompact", "SubagentStart", "SubagentStop",
      "Stop", "Interrupt",
    ],
    moments: {
      sessionStart: "SessionStart", sessionEnd: "SessionEnd", promptSubmitted: "UserPromptSubmit",
      beforeTool: "PreToolUse", afterTool: "PostToolUse", toolFailed: null,
      permissionRequest: "PermissionRequest", beforeCompact: "PreCompact", afterCompact: "PostCompact",
      subagentStart: "SubagentStart", subagentStop: "SubagentStop", stop: "Stop", interrupt: "Interrupt",
      notification: null,
    },
    // By file, and maxChars is why: Codex 0.156 kept only the first and last ~5,000 characters of
    // a hook's context and dropped the middle (measured 2026-09-23), while $CODEX_HOME/AGENTS.md
    // was read whole at 136 KB.
    deliverIdentity: { via: "file", file: places.userInstructionsFile, maxChars: 5000 },
    // Through the shared app-server daemon, not `codex exec`, which blocks until its turn ends. The
    // bin starts the daemon if it is down, starts a named thread with the prompt as its first turn,
    // prints one line of JSON with the thread id, and exits while the thread runs on (measured
    // 2026-10-17 on 0.162.1; src/codex-background.mjs says how). `extra` is the bin's own flags:
    // --approval, --sandbox, --model.
    startBackground: ({ prompt, name, cwd, extra = [] }) => ({ cmd: process.execPath, args: [CODEX_BACKGROUND, "start",
      ...(name ? ["--name", name] : []), ...(cwd ? ["--cwd", cwd] : []), "--codex", envDir(env, "FREEDOM_CODEX_BIN") || "codex", ...extra, "--", prompt] }),
    sessionIdFrom: (output) => {
      for (const line of String(output ?? "").trim().split("\n").reverse()) {
        try { const o = JSON.parse(line); if (o?.ok && o.id) return o.id; } catch { /* not the JSON line */ }
      }
      return null;
    },
    listBackground: () => ({ cmd: process.execPath, args: [CODEX_BACKGROUND, "list", "--codex", envDir(env, "FREEDOM_CODEX_BIN") || "codex"], read: (output) => {
      const o = JSON.parse(String(output).trim().split("\n").pop());
      if (!o?.ok || !Array.isArray(o.sessions)) throw new Error(`codex background list failed: ${o?.error || "no list"}`);
      return o.sessions;
    } }),
    stopBackground: ({ id }) => ({ cmd: process.execPath, args: [CODEX_BACKGROUND, "stop", id, "--codex", envDir(env, "FREEDOM_CODEX_BIN") || "codex"] }),
    runPrompt: ({ prompt, extra = [] }) => ({ cmd: "codex", args: ["exec", ...extra, prompt] }),
    // Source: Freedom's reference file codex-question-cards.md. The async tool takes
    // { questions: [{ title, options: string[] }] }, and its result of `accepted: true` means the
    // card was shown, not answered: the answer arrives as the person's next message.
    questionCard: {
      tools: ["request_user_input_async", "request_user_input"],
      shape: "codex-async",
      read: cardReader((q) => ({ text: q.title, options: q.options })),
      answeredBy: "next-user-message",
      // Codex cards have been reported to answer themselves on a timer (see abilities.cardWaits).
      answerPolicy: "Only the person's next message is an answer. A card that expires, disappears or returns a preselected option is not an answer, and neither is silence or elapsed time.",
    },
    vocabulary: {
      askOperator: null,
      note: "AskUserQuestion is Claude Code's tool name, and Codex does not expose a tool by that name. Where a skill says AskUserQuestion, use the question card tool this session actually exposes (request_user_input_async, or request_user_input where its own description allows it). When neither is exposed, ask the question plainly in chat and keep the decision pending until the person answers.",
    },
    abilities: {
      backgroundSession: yes("2026-10-17", "codex-cli 0.162.1",
        "A thread started on the shared app-server daemon (bin/codex-background.mjs start), whose first turn slept 20 seconds and then wrote a file, kept running after the starting program exited 8.6 seconds in, and the file appeared with nothing connected."),
      phone: yes(TODAY, VERSION,
        "`codex remote-control --help` on this version offers start, stop and pair, and the operator reports reaching Codex sessions from his phone (his firsthand report, 2026-10-13; this package did not start remote control). In September, `codex features list` on 0.156.0 showed `remote_control removed`, which was misread as the feature being gone. The same line still prints on this version, beside the working command."),
      pluginHooks: { answer: "unmeasured",
        evidence: "`codex features list` on 0.156.0 (2026-09-22) reported plugin_hooks as removed and off, while the same binary carried a trust step for plugin hooks. Unresolved." },
      slashCommands: { answer: "no", measured: "2026-09-22", version: "0.156.0",
        evidence: "Freedom's profile, read from the 0.156.0 binary, records custom prompts as deprecated in favour of skills. Skills are attached as $freedom:<skill> instead." },
      subagents: yes(TODAY, VERSION,
        "The operator reports that Codex hands work to helper agents (his firsthand report, 2026-10-13). The binary lists SubagentStart and SubagentStop among its hook events, and `codex features list` on this version shows multi_agent as stable and on. This package did not start a helper itself."),
      mcp: yes("2026-09-23", "0.156.0",
        "Codex 0.156 launched Freedom's two MCP servers from the plugin manifest and resolved a cwd of \".\" against the plugin folder. The first launch line gave zero tools because the plugin root placeholder is passed through as literal text."),
      liveSessionRegistry: { answer: "no", measured: "2026-09-22", version: "0.156.0",
        evidence: "Codex's sessions/ folder holds chat history (dated rollout files), and no per-process registry of running sessions is known." },
      liveSessions: yes("2026-09-23", "0.156.0",
        "A running Codex session holds its rollout file open, so running sessions were listed by reading open files with lsof."),
      askCard: yes(TODAY, VERSION,
        "The operator reports that Codex shows native question cards (his firsthand report, 2026-10-13). Freedom's own reference file, codex-question-cards.md, routes questions to request_user_input_async, where a result of accepted: true means the card was shown, not answered. This package did not show a card itself."),
      cardWaits: { answer: "no", measured: TODAY, version: VERSION,
        evidence: "openai/codex issue 28969, first reported on codex-cli 0.141.0 and still open on 2026-10-13, reports that Codex accepts the recommended answer to a question by itself within 60 seconds, and the operator reports the same from his own use: Codex skips question cards and puts a timer on them. Freedom's reference file, codex-question-cards.md, also notes an expiry countdown. This was not re-timed on the installed version by this package." },
      takesIdentity: yes("2026-09-23", "0.156.0",
        "After Freedom wrote its identity into the file Codex reads at start, a fresh session answered with the agent's given name, a codeword from the workspace, and two standing rules (Freedom's test notes, 2026-09-23)."),
      followsStanding: { answer: "no", measured: "2026-09-23", version: "0.156.0",
        evidence: "In three `codex exec` runs with Freedom installed, given a task that needed something from the person, the model asked in plain chat and never used the tool its instructions named, including when told the person was away from the desk and on a phone. It used the tool only when the prompt named it (Freedom's test notes, 2026-09-23). The operator reported the same on 2026-10-13. It was not rerun on the installed version." },
      steersMidTask: { answer: "no", measured: TODAY, version: VERSION,
        evidence: "The operator's firsthand report of 2026-10-13: redirecting a Codex session while it is working is harder. This is his report, and no timed test was run." },
      extendsSystemPrompt: yes(TODAY, VERSION,
        "`codex --help` and `codex exec --help` on this version list no flag that names the system or developer instructions. They do list `-c, --config <key=value>`, which overrides any config.toml value, and the program's own list of config keys carries `developer_instructions` and `model_instructions_file`. Read from the help text and the program text, not from a session that was started with either key."),
      refuseTool: yes(TODAY, VERSION,
        "Measured with one live run. In an isolated CODEX_HOME whose hooks.json wired PreToolUse to a script, `codex exec --json -s workspace-write --dangerously-bypass-hook-trust` was asked to run `echo SUPERHARNESS_PROBE > probe.txt`. The hook received one PreToolUse payload (tool_name Bash, that command) and replied with permissionDecision deny. Codex logged \"Command blocked by PreToolUse hook: probe\", and probe.txt was not created. Hook trust was bypassed by flag for the run, so this shows that a deny is honoured, not how a hook comes to be trusted."),
      permissionGate: yes("2026-09-23", "0.156.0",
        "A `codex exec` run with approval policy \"never\" refused an MCP tool call with \"MCP tool call requires approval, but approval policy is never\", and the same call went through once the tool's approval mode was set to approve (Freedom's test notes, 2026-09-23). Read on 2026-10-13 from codex-cli 0.162.1: `codex --help` lists `-s, --sandbox` (read-only, workspace-write, danger-full-access) and `-a, --ask-for-approval` (on-request, never), and `codex exec --help` lists `-s, --sandbox`."),
    },
  });
};
