// The superharness standard's clauses, as data. STANDARD.md is the same thing for people; a test
// keeps them in step. The clauses are the questions every adapter answers. The bar (src/bar.mjs)
// is the eleven boxes decided from those answers.
export const STANDARD_VERSION = "2.1.0";

/** The name this export had before the standard had a bar. Kept so an importer does not break. */
export const CONTRACT_VERSION = STANDARD_VERSION;

// `phone` is the ability behind remote control. The key keeps its first name because code reads
// `can.phone`; `defineHarness` mirrors it as `remoteControl`.
export const ABILITIES = ["phone", "backgroundSession", "pluginHooks", "slashCommands",
  "subagents", "mcp", "liveSessionRegistry", "liveSessions", "askCard",
  "refuseTool", "permissionGate", "cardWaits",
  "followsStanding", "steersMidTask", "takesIdentity", "extendsSystemPrompt"];

export const MOMENTS = ["sessionStart", "sessionEnd", "promptSubmitted", "beforeTool",
  "afterTool", "toolFailed", "permissionRequest", "beforeCompact", "afterCompact",
  "subagentStart", "subagentStop", "stop", "interrupt", "notification"];

const c = (group, key, level, kind, says) => ({ id: `${group}.${key}`, group, key, level, kind, says });

export const CLAUSES = [
  c("places", "configDir", "core", "function", "Where the harness keeps its own settings, given a home folder."),
  c("places", "skillsDir", "core", "function", "Where the harness looks for skills."),
  c("places", "transcriptsRoot", "core", "function", "The folder under which conversation records are written."),
  c("places", "settingsFile", "optional", "function", "The settings file a person edits."),
  c("places", "pluginCacheDir", "optional", "function", "Where installed plugins are cached."),
  c("places", "marketplacesDir", "optional", "function", "Where plugin catalogs are cached."),
  c("places", "sessionsDir", "optional", "function", "Where live sessions are registered. Returns null when there is no registry."),
  c("places", "transcriptPath", "optional", "function", "The record for one session, when it can be computed. Returns null when it must be searched for."),
  c("places", "worktreesDir", "optional", "function", "Where working copies of a project are parked."),
  // Added in 2.1.0. A host reads them from @supersuit/superharness/places without loading anything
  // that runs programs.
  c("places", "projectDir", "optional", "function", "The folder inside a project that holds the harness's settings for that project, given the project folder: .claude on Claude Code, .codex on Codex. Returns null when the harness keeps none."),
  c("places", "userInstructionsFile", "optional", "function", "The user-level instruction file the harness reads at the start of every session, given a home folder."),
  c("places", "isInsidePluginFolder", "optional", "predicate", "True when a path is inside a plugin copy the harness keeps, its plugin cache or its plugin catalog folder: (path, home) => boolean. Never throws."),
  c("places", "credentialsFile", "optional", "function", "The file the harness keeps its account credential in, given a home folder. Returns null when the standard names none for this harness."),
  c("places", "bridgeSpawnDir", "optional", "function", "The folder remote control writes one entry into per session it is hosting. Returns null when the standard names none for this harness."),
  c("places", "bridgePointerFile", "optional", "function", "The file remote control keeps for a project folder, naming the environment it will resume there, given a home and that folder. Returns null when the standard names none for this harness, or when an argument is missing."),
  c("actions", "bin", "core", "function", "Finds the harness's own program on this machine."),
  c("actions", "deliverIdentity", "core", "object", "How instruction files reach the model: { via: 'hook-context' | 'file', file?: (home) => path, maxChars?: number }."),
  c("actions", "isTurn", "optional", "function", "True for a record line that is something a person or the model said."),
  c("actions", "startBackground", "optional", "nullable-function", "The command that starts a session nobody is watching: ({ prompt, name, cwd }) => { cmd, args }. Null when the harness cannot."),
  c("actions", "runPrompt", "optional", "nullable-function", "The command that runs one prompt and returns: ({ prompt, cwd }) => { cmd, args }."),
  c("actions", "questionCard", "optional", "object", "How the harness asks the person a question as a card: { tools: string[], shape: string, read: (toolInput) => { questions: [{ text, options }] }, answeredBy: 'tool-result' | 'next-user-message', answerPolicy?: string }."),
  c("actions", "pluginManifestDir", "optional", "string", "The folder name a plugin's manifest lives in."),
  c("actions", "pluginRootEnv", "optional", "string", "The environment variable a hook reads to find its plugin."),
  ...MOMENTS.map((m) => c("moments", m, m === "sessionStart" ? "core" : "optional", "string",
    `The harness's own event name for "${m}", or null when it has none.`)),
  ...ABILITIES.map((a) => c("abilities", a, "optional", "object",
    `Whether the harness has "${a}": { answer: yes | no | unmeasured, measured, version, evidence }.`)),
  c("vocabulary", "askOperator", "optional", "string", "The name of the tool that asks the person a question as a card, or null."),
  c("vocabulary", "note", "optional", "string", "Text given to the model at session start that maps tool names used in skills onto this harness's own, or null."),
];
