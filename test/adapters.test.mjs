// Ported from the origin, freedom-dev tests/harness.test.mjs (v6.29.0, abf68266), lines 55-255.
// Only the way a profile is obtained changed: harness({ env, home }) became claudeCode(env) or
// codex(env). No assertion was weakened. The file and line named in each test title is the origin
// call site the literal was copied from.
import { test } from "node:test";
import assert from "node:assert/strict";
import claudeCode, { slugCwd } from "../src/adapters/claude-code.mjs";
import codex, { isCodexTurn, CODEX_BACKGROUND } from "../src/adapters/codex.mjs";
import { ABILITIES, MOMENTS } from "../src/contract.mjs";

const HOME = "/Users/someone";

// ---------------------------------------------------------------------------
// The pin. Every literal below was copied from the call site named beside it.
// ---------------------------------------------------------------------------

test("claude-code: configDir is what freedom-validate.mjs:41 and freedom-doctor.mjs:100 compute", () => {
  const p = claudeCode({});
  assert.equal(p.configDir(HOME), "/Users/someone/.claude");
});

test("claude-code: CLAUDE_CONFIG_DIR still wins, because four call sites honour it today", () => {
  // freedom-validate.mjs:41, freedom-doctor.mjs:100, freedom-my-skills.mjs:46,
  // freedom-transcript-turns.mjs:72 all read it first. Dropping that in the migration would
  // move an operator's whole config out from under them silently.
  const p = claudeCode({ CLAUDE_CONFIG_DIR: "/somewhere/else" });
  assert.equal(p.configDir(HOME), "/somewhere/else");
});

test("claude-code: an empty or whitespace CLAUDE_CONFIG_DIR is ignored, as the call sites do with .trim()", () => {
  assert.equal(claudeCode({ CLAUDE_CONFIG_DIR: "   " }).configDir(HOME), "/Users/someone/.claude");
  assert.equal(claudeCode({ CLAUDE_CONFIG_DIR: "" }).configDir(HOME), "/Users/someone/.claude");
});

test("claude-code: with CLAUDE_CONFIG_DIR set, every derived path follows it (the documented exception)", () => {
  // Six call sites ignore CLAUDE_CONFIG_DIR today (listed in the profile's header). Pinning the
  // profile's answer here means migrating one of them is a visible, deliberate change: this test
  // says where the path goes, and the migration commit has to say it moved.
  const p = claudeCode({ CLAUDE_CONFIG_DIR: "/cfg" });
  assert.equal(p.settingsFile(HOME), "/cfg/settings.json");
  assert.equal(p.pluginCacheDir(HOME), "/cfg/plugins/cache");
  assert.equal(p.sessionsDir(HOME), "/cfg/sessions");
  assert.equal(p.transcriptsRoot(HOME), "/cfg/projects");
  assert.equal(p.transcriptPath(HOME, "/a/b", "s"), "/cfg/projects/-a-b/s.jsonl");
});

test("claude-code: settingsFile is what freedom-setup-probes.mjs:64 and freedom-remotecontrol.mjs:300 read", () => {
  assert.equal(claudeCode({}).settingsFile(HOME), "/Users/someone/.claude/settings.json");
});

test("claude-code: pluginCacheDir is what freedom-tile-app-host.mjs:231 and freedom-setup-probes.mjs:34 join", () => {
  assert.equal(claudeCode({}).pluginCacheDir(HOME), "/Users/someone/.claude/plugins/cache");
});

test("claude-code: sessionsDir is what freedom-session-name.mjs:105 and freedom-roster.mjs:180 read", () => {
  assert.equal(claudeCode({}).sessionsDir(HOME), "/Users/someone/.claude/sessions");
});

test("claude-code: transcriptsRoot is what freedom-remotesessions.mjs:120 exports as projectsRoot", () => {
  assert.equal(claudeCode({}).transcriptsRoot(HOME), "/Users/someone/.claude/projects");
});

test("claude-code: transcriptPath is byte-for-byte what freedom-transcript-turns.mjs:22 builds", () => {
  // Claude Code's project-directory slug: every non-alphanumeric byte becomes a dash.
  const p = claudeCode({});
  assert.equal(
    p.transcriptPath(HOME, "/Users/someone/Documents/github-repos/garys-freedom", "abc-123"),
    "/Users/someone/.claude/projects/-Users-someone-Documents-github-repos-garys-freedom/abc-123.jsonl",
  );
});

test("claude-code: transcriptPath returns null on a missing argument, as transcript-turns does", () => {
  const p = claudeCode({});
  assert.equal(p.transcriptPath(HOME, "", "abc"), null);
  assert.equal(p.transcriptPath(HOME, "/x", ""), null);
});

test("claude-code: isTurn recognises exactly what freedom-transcript-turns.mjs counts", () => {
  const p = claudeCode({});
  assert.equal(p.isTurn({ type: "user" }), true);
  assert.equal(p.isTurn({ type: "assistant" }), true);
  assert.equal(p.isTurn({ type: "summary" }), false);
  assert.equal(p.isTurn({ type: "file-history-snapshot" }), false);
  assert.equal(p.isTurn(null), false);
});

test("claude-code: worktreesDir is what freedom-burst.mjs:253 and the tile app gate expect", () => {
  assert.equal(claudeCode({}).worktreesDir("/repo"), "/repo/.claude/worktrees");
});

test("claude-code: the plugin manifest folder and the hook root variable are the names in hooks.json", () => {
  const p = claudeCode({});
  assert.equal(p.pluginManifestDir, ".claude-plugin");
  assert.equal(p.pluginRootEnv, "CLAUDE_PLUGIN_ROOT");
});

test("claude-code: every event Freedom's hooks.json wires is declared", () => {
  // If this list and hooks.json drift, a hook is registered for an event the profile says does
  // not exist, and the Codex install step would silently drop it.
  const p = claudeCode({});
  for (const e of [
    "SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse",
    "PostToolUseFailure", "PreCompact", "Stop", "Notification", "PermissionRequest",
  ]) assert.ok(p.events.includes(e), `claude-code profile is missing ${e}`);
});

test("claude-code: the capabilities Freedom relies on today are all true", () => {
  const { can } = claudeCode({});
  assert.equal(can.backgroundSession, true);   // claude --bg
  assert.equal(can.phone, true);               // remote-control LaunchAgent
  assert.equal(can.pluginHooks, true);         // hooks ship inside the plugin
  assert.equal(can.slashCommands, true);
});

// ---------------------------------------------------------------------------
// Codex. Measured from the shipped 0.156.0 binary on 2026-09-22, and where it is
// unproven the profile says so rather than guessing generously.
// ---------------------------------------------------------------------------

test("codex: the config home is ~/.codex, and CODEX_HOME overrides it", () => {
  assert.equal(codex({}).configDir(HOME), "/Users/someone/.codex");
  assert.equal(
    codex({ CODEX_HOME: "/tmp/probe" }).configDir(HOME),
    "/tmp/probe",
  );
});

test("codex: skills already live where Freedom puts them, so this needs no translation", () => {
  assert.equal(codex({}).skillsDir(HOME), "/Users/someone/.codex/skills");
});

test("codex: transcripts are dated rollout files, so there is no path to compute from a session id", () => {
  // ~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl. The cwd is inside the file's
  // first line rather than in its path, so a rollout has to be searched for, never constructed.
  // Returning null is the honest answer and the reason the reader is its own step.
  const p = codex({});
  assert.equal(p.transcriptsRoot(HOME), "/Users/someone/.codex/sessions");
  assert.equal(p.transcriptPath(HOME, "/any/cwd", "abc-123"), null);
});

test("codex: a turn is the event_msg for what was typed, never the response_item Codex injects as a user", () => {
  // Measured on nine real rollouts: every one carries role-"user" response_items for its
  // AGENTS.md and <environment_context>, which nobody typed. The event_msg count matched.
  const p = codex({});
  assert.equal(p.isTurn({ type: "event_msg", payload: { type: "user_message", message: "hi" } }), true);
  assert.equal(p.isTurn({ type: "event_msg", payload: { type: "agent_message", message: "ok" } }), true);
  assert.equal(p.isTurn({ type: "response_item", payload: { type: "message", role: "user" } }), false);
  assert.equal(p.isTurn({ type: "event_msg", payload: { type: "token_count" } }), false);
  assert.equal(p.isTurn({ type: "session_meta", payload: { id: "x" } }), false);
  assert.equal(p.isTurn({ type: "user" }), false, "Claude's shape must not count here, or every rollout doubles");
});

test("codex: the plugin manifest and hook root variable are Claude's, because Codex reads both", () => {
  // Measured in the 0.156.0 binary: it carries `.codex-plugin/plugin.json`,
  // `.claude-plugin/plugin.json` and `.cursor-plugin/plugin.json` together, and its hook
  // environment table carries PLUGIN_ROOT, CLAUDE_PLUGIN_ROOT, PLUGIN_DATA, CLAUDE_PLUGIN_DATA.
  // So Freedom ships ONE manifest and one variable, and a second one would be work for a
  // problem that does not exist.
  const p = codex({});
  assert.equal(p.pluginManifestDir, ".claude-plugin");
  assert.equal(p.pluginRootEnv, "CLAUDE_PLUGIN_ROOT");
});

test("codex: the two events with no twin are absent, and the two the harness does not use are present", () => {
  const p = codex({});
  assert.equal(p.events.includes("PostToolUseFailure"), false);
  assert.equal(p.events.includes("Notification"), false);
  assert.ok(p.events.includes("Interrupt"));
  assert.ok(p.events.includes("PostCompact"));
  assert.ok(p.events.includes("SessionStart"));
});

test("codex: remote control is a yes since 2026-10-13, and slash commands are still a measured no", () => {
  // Until 0.2.0 this was false: `codex features list` on 2026-09-22 printed `remote_control
  // removed`, which was misread as the feature being gone. `codex remote-control` is a working
  // command on 0.162.1 and the operator reports using it from his phone.
  const { can } = codex({});
  assert.equal(can.phone, true);
  assert.equal(can.slashCommands, false); // custom prompts are deprecated in favour of skills
});

test("a capability nobody declared reads as false, never as undefined", () => {
  // A skill writing `if (can.somethingNew)` on an older profile must get a no, not a crash and
  // not a truthy object.
  for (const f of [claudeCode, codex]) {
    const { can } = f({});
    assert.equal(can.aCapabilityNobodyHasDeclared, false);
  }
});

// ---------------------------------------------------------------------------
// The property that makes the migration safe
// ---------------------------------------------------------------------------

test("no profile getter reads the ambient environment or the real home", () => {
  // Every path is a pure function of the home passed in, so a test, a probe and a hook running
  // under launchd all get the same answer. A getter that reached for homedir() itself would
  // make the pin above meaningless.
  const a = claudeCode({});
  const b = claudeCode({});
  assert.equal(a.configDir("/a"), "/a/.claude");
  assert.equal(b.configDir("/zzz"), "/zzz/.claude");
});

test("codex: there is no live-session registry, so sessionsDir is null rather than the history folder", () => {
  // Claude Code's sessions/ holds one pid record per RUNNING session; Codex's sessions/ holds
  // chat history. Same word, different thing. Pointing the roster at rollouts would read every
  // chat Codex ever had as a live tab.
  const p = codex({});
  assert.equal(p.sessionsDir(HOME), null);
  assert.equal(p.can.liveSessionRegistry, false);
  assert.equal(claudeCode({}).can.liveSessionRegistry, true);
});

// ---------------------------------------------------------------------------
// New in this package: the contract's additions on top of the origin profile
// ---------------------------------------------------------------------------

const ORIGIN_KEYS = ["id", "label", "bin", "configDir", "settingsFile", "pluginCacheDir",
  "marketplacesDir", "skillsDir", "sessionsDir", "transcriptsRoot", "transcriptPath", "isTurn",
  "worktreesDir", "pluginManifestDir", "pluginRootEnv", "events", "can"];

test("every key the origin profile has is still on both adapters", () => {
  for (const p of [claudeCode({}), codex({})])
    for (const k of ORIGIN_KEYS) assert.ok(k in p, `${p.id} lost ${k}`);
});

test("the remaining origin strings: labels, marketplaces, skills, and the event lists in the origin's order", () => {
  const cc = claudeCode({}), cx = codex({});
  assert.equal(cc.label, "Claude Code");
  assert.equal(cx.label, "Codex");
  assert.equal(cc.marketplacesDir(HOME), "/Users/someone/.claude/plugins/marketplaces");
  assert.equal(cc.skillsDir(HOME), "/Users/someone/.claude/skills");
  assert.equal(cx.settingsFile(HOME), "/Users/someone/.codex/config.toml");
  assert.equal(cx.pluginCacheDir(HOME), "/Users/someone/.codex/plugins/cache");
  assert.equal(cx.marketplacesDir(HOME), "/Users/someone/.codex/plugins/marketplaces");
  assert.equal(cx.worktreesDir("/repo"), "/repo/.claude/worktrees");
  assert.deepEqual(cc.events, ["SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse",
    "PostToolUseFailure", "PreCompact", "Stop", "Notification", "PermissionRequest", "SubagentStop"]);
  assert.deepEqual(cx.events, ["SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse",
    "PermissionRequest", "PreCompact", "PostCompact", "SubagentStart", "SubagentStop", "Stop", "Interrupt"]);
});

test("the origin's capability table, value for value", () => {
  const want = {
    "claude-code": { backgroundSession: true, phone: true, pluginHooks: true, slashCommands: true,
      subagents: true, mcp: true, liveSessionRegistry: true, liveSessions: true },
    // phone was false at the origin; it is the one value here that 0.2.0 changed, on new evidence.
    codex: { backgroundSession: true, phone: true, pluginHooks: false, slashCommands: false,
      subagents: true, mcp: true, liveSessionRegistry: false, liveSessions: true },
  };
  for (const p of [claudeCode({}), codex({})])
    for (const [k, v] of Object.entries(want[p.id])) assert.equal(p.can[k], v, `${p.id}.can.${k}`);
});

test("codex: the binary honours FREEDOM_CODEX_BIN and otherwise is the bare name, as the origin has it", () => {
  assert.equal(codex({}).bin(), "codex");
  assert.equal(codex({ FREEDOM_CODEX_BIN: " /x/codex " }).bin(), "/x/codex");
  assert.equal(codex({ FREEDOM_CODEX_BIN: "  " }).bin(), "codex");
});

test("claude-code: the binary goes through the resolver with the adapter's own environment", () => {
  assert.equal(claudeCode({ FREEDOM_CLAUDE_BIN: "/x/claude" }).bin({ home: "/U", exists: () => false }), "/x/claude");
  assert.equal(claudeCode({}).bin({ home: "/U", exists: () => false, list: () => [] }), "claude");
});

test("no place getter reads process.env: a poisoned environment changes nothing", () => {
  const real = process.env;
  const places = ["configDir", "settingsFile", "pluginCacheDir", "marketplacesDir", "skillsDir",
    "sessionsDir", "transcriptsRoot", "worktreesDir"];
  for (const f of [claudeCode, codex]) {
    const p = f({});
    process.env = new Proxy({}, { get() { throw new Error("a getter read process.env"); } });
    try {
      for (const k of places) p[k]("/h");
      p.transcriptPath("/h", "/w", "sid");
    } finally { process.env = real; }
  }
});

test("slugCwd and isCodexTurn are exported by name, as the origin exports them", () => {
  assert.equal(slugCwd("/a/b.c"), "-a-b-c");
  assert.equal(isCodexTurn({ type: "event_msg", payload: { type: "item_completed", item: { type: "AgentMessage" } } }), true);
  assert.equal(isCodexTurn({ type: "event_msg", payload: { type: "item_completed", item: { type: "Reasoning" } } }), false);
});

test("every ability is answered by both adapters, and a yes carries date, version and evidence", () => {
  for (const p of [claudeCode({}), codex({})]) {
    for (const a of ABILITIES) {
      const v = p.abilities[a];
      assert.ok(v && ["yes", "no", "unmeasured"].includes(v.answer), `${p.id}.${a}`);
      if (v.answer === "yes") {
        assert.match(v.measured, /^\d{4}-\d{2}-\d{2}$/, `${p.id}.${a} measured`);
        assert.ok(v.version && v.evidence, `${p.id}.${a} version and evidence`);
      }
      assert.equal(p.can[a], v.answer === "yes", `${p.id}.can.${a}`);
    }
  }
});
test("codex: plugin hooks are unmeasured, never a no we did not prove", () => {
  assert.equal(codex({}).abilities.pluginHooks.answer, "unmeasured");
  assert.equal(codex({}).can.pluginHooks, false);
});
test("an answer that rests on the operator's report says so in its evidence sentence", () => {
  const a = codex({}).abilities;
  for (const k of ["phone", "askCard", "subagents"]) {
    assert.match(a[k].evidence, /operator reports/, k);
    assert.match(a[k].evidence, /firsthand report, 2026-10-13/, k);
    assert.equal(a[k].measured, "2026-10-13", k);
    assert.equal(a[k].version, "codex-cli 0.162.1", k);
  }
  assert.match(a.phone.evidence, /start, stop and pair/);
  assert.match(a.phone.evidence, /remote_control removed/);
});
test("the two safety abilities carry what was run or read, on which version, for both harnesses", () => {
  const cx = codex({}).abilities, cc = claudeCode({}).abilities;
  assert.match(cx.refuseTool.evidence, /SUPERHARNESS_PROBE/);
  assert.match(cx.refuseTool.evidence, /probe\.txt was not created/);
  assert.equal(cx.refuseTool.measured, "2026-10-13");
  assert.equal(cx.permissionGate.measured, "2026-09-23");
  assert.equal(cx.permissionGate.version, "0.156.0");
  assert.match(cx.permissionGate.evidence, /approval policy is never/);
  assert.match(cc.refuseTool.evidence, /PreToolUse/);
  assert.match(cc.permissionGate.evidence, /--permission-mode/);
  assert.match(cc.permissionGate.evidence, /--allowedTools/);
});
test("cardWaits: Codex is a measured no that cites the open issue and the operator, and says it was not re-timed", () => {
  const a = codex({}).abilities.cardWaits;
  assert.equal(a.answer, "no");
  assert.equal(a.measured, "2026-10-13");
  assert.equal(a.version, "codex-cli 0.162.1");
  assert.match(a.evidence, /openai\/codex issue 28969/);
  assert.match(a.evidence, /0\.141\.0/);
  assert.match(a.evidence, /operator reports/);
  assert.match(a.evidence, /not re-timed/);
});
test("cardWaits: Claude Code's answer says it was read from the program's settings text, not timed", () => {
  const a = claudeCode({}).abilities.cardWaits;
  assert.equal(a.answer, "yes");
  assert.equal(a.measured, "2026-10-13");
  assert.match(a.evidence, /askUserQuestionTimeout/);
  assert.match(a.evidence, /never/);
  assert.match(a.evidence, /not timed/);
});
test("the moldability and steerability answers say what was run, by whom, on which version, and what was not rerun", () => {
  const cx = codex({}).abilities, cc = claudeCode({}).abilities;
  assert.deepEqual([cx.followsStanding.answer, cx.followsStanding.measured, cx.followsStanding.version], ["no", "2026-09-23", "0.156.0"]);
  assert.match(cx.followsStanding.evidence, /Freedom's test notes/);
  assert.match(cx.followsStanding.evidence, /three `codex exec` runs/);
  assert.match(cx.followsStanding.evidence, /not rerun on the installed version/);
  assert.equal(cc.followsStanding.answer, "unmeasured");
  assert.match(cc.followsStanding.evidence, /has not been run on Claude Code/);
  assert.deepEqual([cc.steersMidTask.answer, cc.steersMidTask.measured, cc.steersMidTask.version], ["yes", "2026-10-13", "2.1.296 (Claude Code)"]);
  assert.deepEqual([cx.steersMidTask.answer, cx.steersMidTask.measured, cx.steersMidTask.version], ["no", "2026-10-13", "codex-cli 0.162.1"]);
  assert.match(cx.steersMidTask.evidence, /operator's firsthand report/);
  assert.match(cx.steersMidTask.evidence, /no timed test was run/);
  assert.deepEqual([cx.takesIdentity.answer, cx.takesIdentity.measured, cx.takesIdentity.version], ["yes", "2026-09-23", "0.156.0"]);
  assert.equal(cc.takesIdentity.answer, "yes");
  assert.match(cc.extendsSystemPrompt.evidence, /--append-system-prompt/);
  assert.match(cc.extendsSystemPrompt.evidence, /--system-prompt/);
  assert.equal(cx.extendsSystemPrompt.answer, "yes");
  assert.match(cx.extendsSystemPrompt.evidence, /developer_instructions/);
  assert.match(cx.extendsSystemPrompt.evidence, /no flag/i);
});
test("no evidence sentence states a motive or carries an em dash", () => {
  for (const p of [claudeCode({}), codex({})])
    for (const [k, a] of Object.entries(p.abilities)) {
      if (!a.evidence) continue;
      assert.ok(!a.evidence.includes("\u2014"), `${p.id}.${k}`);
      assert.ok(!/\b(wants?|chose|decided|refuses to|intends?|strategy)\b/i.test(a.evidence), `${p.id}.${k}`);
    }
});
test("every moment is answered with the harness's own event name or null", () => {
  for (const p of [claudeCode({}), codex({})]) {
    for (const m of MOMENTS) assert.ok(m in p.moments, `${p.id}.${m}`);
    assert.equal(p.moments.sessionStart, "SessionStart");
  }
  assert.equal(codex({}).moments.toolFailed, null);
  assert.equal(codex({}).moments.notification, null);
  assert.equal(claudeCode({}).moments.toolFailed, "PostToolUseFailure");
});
test("the moments and the event list agree: every named moment is an event, and every event is a moment", () => {
  for (const p of [claudeCode({}), codex({})]) {
    const named = Object.values(p.moments).filter(Boolean).sort();
    assert.deepEqual(named, [...p.events].sort(), p.id);
  }
});
test("startBackground builds the command Freedom runs today", () => {
  const cc = claudeCode({}).startBackground({ prompt: "hi", name: "Freedom" });
  assert.deepEqual(cc.args.slice(0, 1), ["--bg"]);
  assert.deepEqual(cc.args.slice(-4), ["--name", "Freedom", "--", "hi"]);
  // Codex starts through the shared app-server daemon (2.2.0): `codex exec` blocks until its turn
  // ends, so it was never a background session.
  const cx = codex({}).startBackground({ prompt: "hi", name: "Freedom", cwd: "/w" });
  assert.equal(cx.cmd, process.execPath);
  assert.deepEqual(cx.args.slice(0, 2), [CODEX_BACKGROUND, "start"]);
  assert.deepEqual(cx.args.slice(2, 6), ["--name", "Freedom", "--cwd", "/w"]);
  assert.deepEqual(cx.args.slice(-2), ["--", "hi"]);
  assert.ok(!cx.args.includes("exec"));
});
test("each harness reads its own session id out of what starting one printed", () => {
  assert.equal(claudeCode({}).sessionIdFrom("Started. Run 'claude attach abc12345' to open it."), "abc12345");
  assert.equal(claudeCode({}).sessionIdFrom("nothing here"), null);
  assert.equal(codex({}).sessionIdFrom('noise\n{"ok":true,"id":"01a14c39-156d","turnId":"t1"}\n'), "01a14c39-156d");
  assert.equal(codex({}).sessionIdFrom('{"ok":false,"error":"no daemon"}'), null);
});
test("each harness lists and stops its background sessions with its own command", () => {
  const cl = claudeCode({}).listBackground();
  assert.deepEqual([cl.cmd, ...cl.args], ["claude", "agents", "--json"]);
  assert.deepEqual(cl.read('[{"name":"a","kind":"background"}]'), [{ name: "a", kind: "background" }]);
  assert.deepEqual(claudeCode({}).stopBackground({ id: "abc12345" }), { cmd: "claude", args: ["stop", "abc12345"] });
  const xl = codex({}).listBackground();
  assert.deepEqual(xl.args.slice(0, 2), [CODEX_BACKGROUND, "list"]);
  assert.deepEqual(xl.read('{"ok":true,"sessions":[{"id":"t","status":"busy"}]}'), [{ id: "t", status: "busy" }]);
  assert.throws(() => xl.read('{"ok":false,"error":"no daemon"}'), /no daemon/);
  assert.deepEqual(codex({}).stopBackground({ id: "t" }).args.slice(0, 3), [CODEX_BACKGROUND, "stop", "t"]);
});
test("identity delivery differs, and the contract says how", () => {
  assert.equal(claudeCode({}).deliverIdentity.via, "hook-context");
  const d = codex({ CODEX_HOME: "/x/.codex" }).deliverIdentity;
  assert.equal(d.via, "file");
  assert.equal(d.file("/home/u"), "/x/.codex/AGENTS.md");
});
test("vocabulary: Claude Code has the question card natively; Codex gets a note", () => {
  assert.equal(claudeCode({}).vocabulary.askOperator, "AskUserQuestion");
  assert.equal(codex({}).vocabulary.askOperator, null);
  assert.ok(codex({}).vocabulary.note.length > 20);
});

// ContinentalWorks/supersuit-dev#929: the `freedom:` skill prefix is retired on both harnesses
// (Claude Code 2026-10-23, Codex supersuit-dev#916), so an adapter's evidence that still tells a
// host to type it points at an alias that attaches nothing.
test("no adapter evidence names the retired freedom: skill prefix", () => {
  for (const [name, profile] of [["claude-code", claudeCode({})], ["codex", codex({})]]) {
    const text = JSON.stringify(profile);
    assert.ok(text.includes("supersuit:<skill>"), `${name} names no skill prefix at all`);
    assert.doesNotMatch(text, /[/$]freedom:<skill>/, `${name} still names the retired freedom: prefix`);
  }
});
