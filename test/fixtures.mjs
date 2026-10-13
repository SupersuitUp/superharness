// A toy adapter that meets all eleven boxes of the bar, and the pieces to break one box at a time.
import { defineHarness } from "../src/define.mjs";

export const Y = { answer: "yes", measured: "2026-01-02", version: "1.0.0", evidence: "seen" };

const read = (input) => ({
  questions: (Array.isArray(input?.questions) ? input.questions : [])
    .filter((q) => q && typeof q.text === "string")
    .map((q) => ({ text: q.text, options: Array.isArray(q.options) ? q.options : [] })),
});

export const superSpec = (over = {}) => ({
  id: "toy", label: "Toy",
  configDir: (h) => h + "/.toy", skillsDir: (h) => h + "/.toy/skills", transcriptsRoot: (h) => h + "/.toy/log",
  bin: () => "toy", deliverIdentity: { via: "hook-context" },
  isTurn: (o) => !!o && (o.role === "user" || o.role === "assistant"),
  startBackground: ({ prompt }) => ({ cmd: "toy", args: ["run", prompt] }),
  moments: { sessionStart: "Start", beforeTool: "BeforeTool" },
  questionCard: { tools: ["ask"], shape: "toy", read, answeredBy: "tool-result" },
  abilities: { mcp: Y, backgroundSession: Y, subagents: Y, refuseTool: Y, permissionGate: Y, phone: Y, askCard: Y },
  ...over,
});

/** A superharness that exists only in tests. */
export const superToy = (over = {}) => defineHarness(superSpec(over));

/** The same toy with some abilities replaced. */
export const withAbilities = (abilities, over = {}) =>
  superToy({ ...over, abilities: { ...superSpec().abilities, ...abilities } });

/** The source of an adapter file for the toy superharness, for tests that load a file. */
export const SUPER_TOY_FILE = `const Y = { answer: "yes", measured: "2026-01-02", version: "1.0.0", evidence: "seen" };
export default () => ({ id: "supertoy", label: "Supertoy",
  configDir: (h) => h + "/.supertoy", skillsDir: (h) => h + "/.supertoy/skills", transcriptsRoot: (h) => h + "/.supertoy/log",
  bin: () => "supertoy-that-is-not-installed", deliverIdentity: { via: "hook-context" },
  isTurn: (o) => !!o && (o.role === "user" || o.role === "assistant"),
  startBackground: ({ prompt }) => ({ cmd: "supertoy", args: ["run", prompt] }),
  moments: { sessionStart: "Start", beforeTool: "BeforeTool" },
  questionCard: { tools: ["ask"], shape: "toy", answeredBy: "tool-result",
    read: (i) => ({ questions: (Array.isArray(i?.questions) ? i.questions : []).map((q) => ({ text: String(q?.text ?? ""), options: [] })) }) },
  abilities: { mcp: Y, backgroundSession: Y, subagents: Y, refuseTool: Y, permissionGate: Y, phone: Y, askCard: Y } });`;
