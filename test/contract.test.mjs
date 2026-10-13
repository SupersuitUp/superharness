import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTRACT_VERSION, STANDARD_VERSION, CLAUSES, ABILITIES, MOMENTS } from "../src/contract.mjs";

test("the standard has a semver version, and the old export name still answers with it", () => {
  assert.match(STANDARD_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(CONTRACT_VERSION, STANDARD_VERSION);
});
test("every clause has a unique id, a known group, a level and a plain sentence", () => {
  const ids = new Set();
  for (const c of CLAUSES) {
    assert.ok(!ids.has(c.id), `duplicate ${c.id}`); ids.add(c.id);
    assert.ok(["places", "actions", "moments", "abilities", "vocabulary"].includes(c.group), c.id);
    assert.ok(["core", "optional"].includes(c.level), c.id);
    assert.ok(c.says.length > 10 && !c.says.includes("\u2014"), c.id);
  }
});
test("the core is small: places, the binary, identity delivery and session start", () => {
  const core = CLAUSES.filter((c) => c.level === "core").map((c) => c.id).sort();
  assert.deepEqual(core, [
    "actions.bin", "actions.deliverIdentity", "moments.sessionStart",
    "places.configDir", "places.skillsDir", "places.transcriptsRoot",
  ]);
});
test("the abilities and moments the contract names are fixed lists", () => {
  assert.deepEqual(ABILITIES.slice(0, 9), ["phone", "backgroundSession", "pluginHooks", "slashCommands",
    "subagents", "mcp", "liveSessionRegistry", "liveSessions", "askCard"]);
  assert.deepEqual(ABILITIES.slice(9), ["refuseTool", "permissionGate", "cardWaits"]);
  assert.deepEqual(MOMENTS, ["sessionStart", "sessionEnd", "promptSubmitted", "beforeTool",
    "afterTool", "toolFailed", "permissionRequest", "beforeCompact", "afterCompact",
    "subagentStart", "subagentStop", "stop", "interrupt", "notification"]);
});
