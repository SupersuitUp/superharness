// Codex's answers to the harness contract.
//
// THE SAFETY PROPERTY is the same as the Claude Code adapter's: every key Freedom's own Codex
// profile had (v6.29.0, freedom-harness.mjs) returns the same string here.
//
// WHAT IS MEASURED AND WHAT IS NOT. The places, the manifest folder, the hook variable and the
// event list were read out of the shipped 0.156.0 binary on 2026-09-22. Each ability below says
// what was observed, on which version, on which date. Where nothing was observed on a session
// that ran, the answer is "unmeasured", which scores nothing and is never shown as a no.
import { join } from "node:path";
import { defineHarness } from "../define.mjs";

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

export default (env = {}) => {
  const configDir = (home) => envDir(env, "CODEX_HOME") || join(home, ".codex");
  return defineHarness({
    id: "codex",
    label: "Codex",
    bin: () => envDir(env, "FREEDOM_CODEX_BIN") || "codex",
    configDir,
    settingsFile: (home) => join(configDir(home), "config.toml"),
    pluginCacheDir: (home) => join(configDir(home), "plugins", "cache"),
    marketplacesDir: (home) => join(configDir(home), "plugins", "marketplaces"),
    skillsDir: (home) => join(configDir(home), "skills"),
    // Claude Code's `sessions/` is a registry of LIVE sessions (one pid record each). Codex's
    // `sessions/` is the same word for its chat HISTORY, so returning it here would point a
    // roster at rollouts. No live registry is known on Codex; null makes a caller say so instead
    // of reading the wrong thing.
    sessionsDir: () => null,
    transcriptsRoot: (home) => join(configDir(home), "sessions"),
    // ~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl. The working directory is
    // inside the file's first line (`session_meta`) rather than in its path, so a rollout is
    // searched for and never constructed. Null is the honest answer.
    transcriptPath: () => null,
    // The typed turn is the event_msg, NOT the response_item with role "user": Codex writes
    // those for context nobody typed (its injected AGENTS.md, <environment_context>,
    // <turn_aborted>). Measured on nine real rollouts.
    isTurn: isCodexTurn,
    // Deliberately the same path as Claude Code's. A worktree is a git worktree; the directory
    // is only a convention about where they are parked. Two homes would mean a worktree made
    // under one harness is invisible to the other on the same repo, for no gain.
    worktreesDir: (root) => join(root, ".claude", "worktrees"),
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
    deliverIdentity: { via: "file", file: (home) => join(configDir(home), "AGENTS.md"), maxChars: 5000 },
    startBackground: ({ prompt, extra = [] }) => ({ cmd: "codex", args: ["exec", "--json", ...extra, prompt] }),
    runPrompt: ({ prompt, extra = [] }) => ({ cmd: "codex", args: ["exec", ...extra, prompt] }),
    vocabulary: {
      askOperator: null,
      note: "AskUserQuestion is Claude Code's tool name, and Codex does not expose a tool by that name. Where a skill says AskUserQuestion, use the question card tool this session actually exposes (request_user_input_async, or request_user_input where its own description allows it). When neither is exposed, ask the question plainly in chat and keep the decision pending until the person answers.",
    },
    abilities: {
      backgroundSession: yes("2026-09-24", "0.156.0",
        "`codex exec` ran a turn from the command line in an isolated CODEX_HOME with the Freedom plugin installed, and attached the named skill's SKILL.md to that turn."),
      phone: { answer: "unmeasured",
        evidence: "`codex features list` on 0.156.0 (2026-09-22) reported remote_control as removed and off. No other route to a phone was tried on a session that ran, so this is not a measured no." },
      pluginHooks: { answer: "unmeasured",
        evidence: "`codex features list` on 0.156.0 (2026-09-22) reported plugin_hooks as removed and off, while the same binary carried a trust step for plugin hooks. Unresolved." },
      slashCommands: { answer: "no", measured: "2026-09-22", version: "0.156.0",
        evidence: "Freedom's profile, read from the 0.156.0 binary, records custom prompts as deprecated in favour of skills. Skills are attached as $freedom:<skill> instead." },
      subagents: yes("2026-09-22", "0.156.0",
        "The 0.156.0 binary's own hook event list carries SubagentStart and SubagentStop. Read from the binary; not yet observed on a session that ran."),
      mcp: yes("2026-09-23", "0.156.0",
        "Codex 0.156 launched Freedom's two MCP servers from the plugin manifest and resolved a cwd of \".\" against the plugin folder. The first launch line gave zero tools because the plugin root placeholder is passed through as literal text."),
      liveSessionRegistry: { answer: "no", measured: "2026-09-22", version: "0.156.0",
        evidence: "Codex's sessions/ folder holds chat history (dated rollout files), and no per-process registry of running sessions is known." },
      liveSessions: yes("2026-09-23", "0.156.0",
        "A running Codex session holds its rollout file open, so running sessions were listed by reading open files with lsof."),
      askCard: { answer: "unmeasured",
        evidence: "Freedom's Codex guidance routes questions to request_user_input_async when a session exposes it, but no dated, versioned observation of a card being shown and answered is on record." },
    },
  });
};
