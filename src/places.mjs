// Where each shipped harness keeps things, and nothing else.
//
// This module is its own entry point, @supersuit/superharness/places, for a host that must not
// load any module able to start a program: a health check that refuses such imports can still read
// where a harness keeps its settings, skills, records and plugins. It imports node:path and
// nothing more, and test/places.test.mjs walks its import graph to keep it that way.
//
// The full adapters (src/adapters/*.mjs) take their places from the functions here, so every path
// has one body. Every key 0.2.0 answered is answered with the same string, pinned against a
// recording of the 0.2.0 answers in test/places-0.2.0.json.
//
// No getter reads process.env or the real home. The environment is the factory's argument and the
// home is each getter's argument, so a test, a probe and a hook under launchd get one answer.
import { join, sep } from "node:path";

/** An env var that is set but blank is unset, which is what every call site's `.trim()` means. */
const envDir = (env, name) => {
  const v = env?.[name];
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/** Claude Code's project-directory slug: every non-alphanumeric byte becomes a dash. */
export const slugCwd = (cwd) => String(cwd || "").replace(/[^a-zA-Z0-9]/g, "-");

/** The folder itself, or anything under it. */
const inside = (p, dir) =>
  typeof dir === "string" && dir !== "" && (p === dir || p.startsWith(dir.endsWith(sep) ? dir : dir + sep));

/**
 * The shape test Freedom used before this clause existed, kept so a host moving onto it loses no
 * answer: any path that runs through a `.claude/plugins/` folder or a `plugins/cache/` folder,
 * written with the platform separator. Freedom has it twice (freedom-workspace.mjs inPluginCache,
 * freedom_self.py _in_plugin_cache), and the two agree.
 */
const pluginShape = (p) =>
  p.includes(`${sep}.claude${sep}plugins${sep}`) || p.includes(`${sep}plugins${sep}cache${sep}`);

/**
 * True when `path` is a plugin copy: anything the shape test above matches, or anything inside
 * this harness's own plugin cache or plugin catalog folder for `home`. Never throws.
 */
const pluginFolderTest = (pluginCacheDir, marketplacesDir) => (path, home) => {
  if (typeof path !== "string" || path === "") return false;
  if (pluginShape(path)) return true;
  if (typeof home !== "string" || home === "") return false;
  return inside(path, pluginCacheDir(home)) || inside(path, marketplacesDir(home));
};

/** Claude Code's places. Honours CLAUDE_CONFIG_DIR the way Claude Code itself does. */
export function claudeCodePlaces(env = {}) {
  const configDir = (home) => envDir(env, "CLAUDE_CONFIG_DIR") || join(home, ".claude");
  const transcriptsRoot = (home) => join(configDir(home), "projects");
  const pluginCacheDir = (home) => join(configDir(home), "plugins", "cache");
  const marketplacesDir = (home) => join(configDir(home), "plugins", "marketplaces");
  return {
    configDir,
    settingsFile: (home) => join(configDir(home), "settings.json"),
    pluginCacheDir,
    marketplacesDir,
    skillsDir: (home) => join(configDir(home), "skills"),
    sessionsDir: (home) => join(configDir(home), "sessions"),
    transcriptsRoot,
    // ~/.claude/projects/<cwd slug>/<sessionId>.jsonl. Null on a missing argument.
    transcriptPath: (home, cwd, sessionId) =>
      home && cwd && sessionId
        ? join(configDir(home), "projects", slugCwd(cwd), `${sessionId}.jsonl`)
        : null,
    // Claude Code's own worktree home. The Codex places return the same path on purpose; see the
    // note there.
    worktreesDir: (root) => join(root, ".claude", "worktrees"),
    // The folder inside a project that holds its project-level settings.
    projectDir: (root) => join(root, ".claude"),
    // The user-level instruction file a session starts from.
    userInstructionsFile: (home) => join(configDir(home), "CLAUDE.md"),
    isInsidePluginFolder: pluginFolderTest(pluginCacheDir, marketplacesDir),
    // The account credential file, on a machine that keeps it in a file rather than the keychain.
    credentialsFile: (home) => join(configDir(home), ".credentials.json"),
    // Remote control writes one folder here per session it is hosting.
    bridgeSpawnDir: (home) => join(configDir(home), "bridge-spawn"),
    // Remote control's note of the environment it will resume in a folder: beside that folder's
    // session records, under the same slug. Null on a missing argument, like transcriptPath.
    bridgePointerFile: (home, cwd) =>
      home && cwd ? join(transcriptsRoot(home), slugCwd(cwd), "bridge-pointer.json") : null,
  };
}

/** Codex's places. Honours CODEX_HOME. */
export function codexPlaces(env = {}) {
  const configDir = (home) => envDir(env, "CODEX_HOME") || join(home, ".codex");
  const pluginCacheDir = (home) => join(configDir(home), "plugins", "cache");
  const marketplacesDir = (home) => join(configDir(home), "plugins", "marketplaces");
  return {
    configDir,
    settingsFile: (home) => join(configDir(home), "config.toml"),
    pluginCacheDir,
    marketplacesDir,
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
    // Deliberately the same path as Claude Code's. A worktree is a git worktree; the directory
    // is only a convention about where they are parked. Two homes would mean a worktree made
    // under one harness is invisible to the other on the same repo, for no gain.
    worktreesDir: (root) => join(root, ".claude", "worktrees"),
    // Read from the program text of codex-cli 0.162.1 on 2026-10-13: "Project `.codex/config.toml`:
    // settings for a trusted repository, including sandbox, MCP, hooks, model, and reasoning
    // defaults."
    projectDir: (root) => join(root, ".codex"),
    // $CODEX_HOME/AGENTS.md, read whole at session start. The adapter's deliverIdentity.file is
    // this same function.
    userInstructionsFile: (home) => join(configDir(home), "AGENTS.md"),
    isInsidePluginFolder: pluginFolderTest(pluginCacheDir, marketplacesDir),
    // These three name Claude Code's own files. This package names no Codex counterpart for any
    // of them, so each answers null and a caller says so instead of guessing a path.
    credentialsFile: () => null,
    bridgeSpawnDir: () => null,
    bridgePointerFile: () => null,
  };
}

/** The places of every shipped harness, by id: `PLACES[id](env)`. */
export const PLACES = Object.freeze({ "claude-code": claudeCodePlaces, codex: codexPlaces });
