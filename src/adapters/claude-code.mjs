// Claude Code's answers to the harness contract.
//
// THE SAFETY PROPERTY. Every key Freedom's own profile had (v6.29.0, freedom-harness.mjs) returns
// the SAME STRING here for the same environment, home, working directory and session id. Not an
// equivalent value: the same one, pinned in test/adapters.test.mjs against the literal and the
// call site it came from. The contract's additions (moments, abilities, deliverIdentity,
// startBackground, runPrompt, vocabulary) sit beside those keys and change none of them.
//
// No getter reads process.env or the real home. The environment is the factory's argument and the
// home is each getter's argument, so a test, a probe and a hook under launchd get one answer.
import { join } from "node:path";
import { claudeBin } from "../bin-resolver.mjs";
import { defineHarness } from "../define.mjs";

/** An env var that is set but blank is unset, which is what every call site's `.trim()` means. */
const envDir = (env, name) => {
  const v = env?.[name];
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/** Claude Code's project-directory slug: every non-alphanumeric byte becomes a dash. */
export const slugCwd = (cwd) => String(cwd || "").replace(/[^a-zA-Z0-9]/g, "-");

// What every "yes" below was measured on: `claude --version` on the maintainer's Mac that day.
const MEASURED = "2026-10-13";
const VERSION = "2.1.296 (Claude Code)";
const yes = (evidence) => ({ answer: "yes", measured: MEASURED, version: VERSION, evidence });

export default (env = {}) => {
  // Honours CLAUDE_CONFIG_DIR the way Claude Code itself does; every getter below derives from it.
  const configDir = (home) => envDir(env, "CLAUDE_CONFIG_DIR") || join(home, ".claude");
  return defineHarness({
    id: "claude-code",
    label: "Claude Code",
    bin: (opts = {}) => claudeBin({ env, ...opts }),
    configDir,
    settingsFile: (home) => join(configDir(home), "settings.json"),
    pluginCacheDir: (home) => join(configDir(home), "plugins", "cache"),
    marketplacesDir: (home) => join(configDir(home), "plugins", "marketplaces"),
    skillsDir: (home) => join(configDir(home), "skills"),
    sessionsDir: (home) => join(configDir(home), "sessions"),
    transcriptsRoot: (home) => join(configDir(home), "projects"),
    // ~/.claude/projects/<cwd slug>/<sessionId>.jsonl. Null on a missing argument.
    transcriptPath: (home, cwd, sessionId) =>
      home && cwd && sessionId
        ? join(configDir(home), "projects", slugCwd(cwd), `${sessionId}.jsonl`)
        : null,
    isTurn: (o) => !!o && (o.type === "user" || o.type === "assistant"),
    // Claude Code's own worktree home. The Codex adapter returns the same path on purpose; see
    // the note there.
    worktreesDir: (root) => join(root, ".claude", "worktrees"),
    pluginManifestDir: ".claude-plugin",
    pluginRootEnv: "CLAUDE_PLUGIN_ROOT",
    // The origin's list, in the origin's order. Passed explicitly so the order is byte-identical
    // rather than derived from the moments table below.
    events: [
      "SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse",
      "PostToolUseFailure", "PreCompact", "Stop", "Notification", "PermissionRequest",
      "SubagentStop",
    ],
    moments: {
      sessionStart: "SessionStart", sessionEnd: "SessionEnd", promptSubmitted: "UserPromptSubmit",
      beforeTool: "PreToolUse", afterTool: "PostToolUse", toolFailed: "PostToolUseFailure",
      permissionRequest: "PermissionRequest", beforeCompact: "PreCompact", afterCompact: null,
      subagentStart: null, subagentStop: "SubagentStop", stop: "Stop", interrupt: null,
      notification: "Notification",
    },
    // Instruction files reach the model as context a session-start hook returns.
    deliverIdentity: { via: "hook-context" },
    startBackground: ({ prompt, name = "Freedom", extra = [] }) =>
      ({ cmd: "claude", args: ["--bg", ...extra, "--name", name, "--", prompt] }),
    runPrompt: ({ prompt, extra = [] }) => ({ cmd: "claude", args: ["-p", ...extra, prompt] }),
    vocabulary: { askOperator: "AskUserQuestion", note: null },
    abilities: {
      backgroundSession: yes("`claude --help` on this version lists `--bg, --background`, and Freedom's spin-up-freedom-session script dispatches every background session with `claude --bg`."),
      phone: yes("`claude --help` on this version lists `--remote-control`, and the com.getfreedom.remotecontrol LaunchAgent that runs `claude remote-control` was loaded on the measuring Mac."),
      pluginHooks: yes("Freedom ships its hooks inside the plugin (hooks/hooks.json), and Claude Code runs them from the installed plugin with CLAUDE_PLUGIN_ROOT set."),
      slashCommands: yes("Freedom's skills are invoked by name as /freedom:<skill> in Claude Code sessions."),
      subagents: yes("This package was built by a subagent that a Claude Code session on this version dispatched."),
      mcp: yes("`claude --help` on this version lists `--mcp-config`, and MCP server tools were loaded in the session that built this package."),
      liveSessionRegistry: yes("~/.claude/sessions held per-process <pid>.json records for running sessions on the measuring Mac (28 entries that day)."),
      liveSessions: yes("Running sessions are listed by reading the ~/.claude/sessions registry, which Freedom's roster does."),
      askCard: yes("Claude Code exposes the AskUserQuestion tool, and Freedom's away-board hook acts on calls to it."),
    },
  });
};
