// Which harness this machine is running inside, and the adapters that can answer for one.
//
// The resolver is Freedom's (v6.29.0, freedom-harness.mjs), moved here with its two hard-coded
// names turned into options that default to what they were: the environment variable
// (FREEDOM_HARNESS) and the machine config file (~/.freedom/config.json). So Freedom gets the
// answers it got before, and another product can use the same resolver under its own names.
//
// A third harness is one file. `loadAdapter(path)` reads it, `register(id, factory)` makes it
// resolvable, and neither needs a change to this package.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineHarness } from "./define.mjs";
import claudeCode from "./adapters/claude-code.mjs";
import codex from "./adapters/codex.mjs";

export const DEFAULT_HARNESS = "claude-code";

/** The adapters this package ships. */
export const BUILTIN = Object.freeze({ "claude-code": claudeCode, codex });

/** The ids of the shipped adapters. A registered outside adapter is resolvable but is not listed here. */
export const HARNESSES = Object.keys(BUILTIN);

/** An env var that is set but blank is unset, which is what every call site's `.trim()` means. */
const envDir = (env, name) => {
  const v = env?.[name];
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/** Whatever a factory returns leaves here as a full profile: `can`, every ability, every moment. */
const guaranteed = (factory) => (env = {}) => {
  const p = factory(env);
  return p && p.can && p.abilities && p.moments ? p : defineHarness(p || {});
};

const REGISTRY = new Map(Object.entries(BUILTIN));

/** Make an adapter resolvable by id. A builtin id cannot be replaced. */
export function register(id, factory) {
  if (typeof id !== "string" || !id.trim()) throw new TypeError("register: id must be a non-empty string");
  if (typeof factory !== "function") throw new TypeError("register: factory must be a function (env) => profile");
  if (id in BUILTIN) throw new Error(`register: "${id}" is a shipped adapter and cannot be replaced`);
  REGISTRY.set(id, guaranteed(factory));
}

/**
 * An adapter factory, from a shipped id or from a file.
 *
 * The file's default export is either a factory `(env) => spec` or a plain spec object. Either
 * way the factory returned here yields a full profile.
 */
export async function loadAdapter(pathOrId) {
  if (REGISTRY.has(pathOrId)) return REGISTRY.get(pathOrId);
  const mod = await import(pathToFileURL(resolve(String(pathOrId))).href);
  const d = mod.default;
  if (typeof d === "function") return guaranteed(d);
  if (d && typeof d === "object") return guaranteed(() => d);
  throw new Error(`${pathOrId}: no default export that is an adapter factory or a spec object`);
}

/** The shipped profiles, built with an empty environment. For tests and for anything enumerating them. */
export const PROFILES = Object.fromEntries(HARNESSES.map((id) => [id, BUILTIN[id]({})]));

const freedomConfigFile = (home) => join(home, ".freedom", "config.json");

/** The machine's own note about itself. */
function machineConfig(home, configFile = freedomConfigFile) {
  try {
    return JSON.parse(readFileSync(configFile(home), "utf8"));
  } catch {
    return {};
  }
}

/**
 * Which harness this is, by name.
 *
 * The environment variable wins, so a test, a probe or one session can switch without touching
 * the machine; then `harness` in the config file; then the default. An unknown name falls back
 * rather than throwing, because a typo in a config file must not stop every hook on the machine.
 */
export function harnessId({
  env = process.env, home = homedir(), config = undefined,
  envVar = "FREEDOM_HARNESS", configFile = freedomConfigFile, known = undefined,
} = {}) {
  const cfg = config ?? machineConfig(home, configFile);
  const want = envDir(env, envVar) || (typeof cfg?.harness === "string" ? cfg.harness.trim() : "");
  const ids = known ?? [...REGISTRY.keys()];
  return ids.includes(want) && REGISTRY.has(want) ? want : DEFAULT_HARNESS;
}

/** The profile for this machine. Every path on it is a pure function of the home passed in. */
export function harness({ env = process.env, home = homedir(), config = undefined, envVar, configFile, known } = {}) {
  return REGISTRY.get(harnessId({ env, home, config, envVar, configFile, known }))(env);
}

/** True when this machine is running something other than the default. For honest reporting. */
export const isSwapped = (opts = {}) => harnessId(opts) !== DEFAULT_HARNESS;

/** Whether a harness is installed at all, by asking for its config directory. */
export function installed(profile, home = homedir(), exists = existsSync) {
  return exists(profile.configDir(home));
}
