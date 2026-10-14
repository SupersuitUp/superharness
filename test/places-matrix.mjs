// Every place answer an adapter gives over a fixed matrix of environments, homes, working
// directories, session ids and project folders. test/places-0.2.0.json is this function's output
// for the 0.2.0 adapters, recorded from the 0.2.0 source before 0.3.0 changed a line, so a test can
// prove the answers did not move.
export const ENVS = [{}, { CLAUDE_CONFIG_DIR: "" }, { CLAUDE_CONFIG_DIR: "   " }, { CLAUDE_CONFIG_DIR: "/cfg" },
  { CLAUDE_CONFIG_DIR: "  /cfg/  " }, { CODEX_HOME: "" }, { CODEX_HOME: "  " }, { CODEX_HOME: "/tmp/probe" },
  { CODEX_HOME: " /x/.codex " }, { CLAUDE_CONFIG_DIR: "/c", CODEX_HOME: "/d" }, { CLAUDE_CONFIG_DIR: "rel/cfg", CODEX_HOME: "rel/cx" }];
export const HOMES = ["/Users/someone", "/h", "/trailing/", "relative/home", ""];
export const CWDS = ["/Users/someone/Documents/github-repos/garys-freedom", "/a/b.c", "rel/x y", "", "/"];
export const SIDS = ["abc-123", "", "s"];
export const ROOTS = ["/repo", "/repo/", "rel", ""];
export const HOME_KEYS = ["configDir", "settingsFile", "pluginCacheDir", "marketplacesDir", "skillsDir", "sessionsDir", "transcriptsRoot"];

const q = JSON.stringify;

/** The 0.2.0 place answers of one profile. */
export function answers(p) {
  const values = {};
  for (const k of HOME_KEYS) for (const h of HOMES) values[`${k}(${q(h)})`] = p[k](h);
  for (const h of HOMES) for (const c of CWDS) for (const s of SIDS) values[`transcriptPath(${q(h)},${q(c)},${q(s)})`] = p.transcriptPath(h, c, s);
  for (const r of ROOTS) values[`worktreesDir(${q(r)})`] = p.worktreesDir(r);
  if (p.deliverIdentity?.file) for (const h of HOMES) values[`deliverIdentity.file(${q(h)})`] = p.deliverIdentity.file(h);
  values.pluginManifestDir = p.pluginManifestDir;
  values.pluginRootEnv = p.pluginRootEnv;
  return values;
}

/** One row per shipped adapter per environment, in the order the fixture holds them. */
export const record = (byId) => Object.entries(byId).flatMap(([id, f]) => ENVS.map((env) => ({ id, env, values: answers(f(env)) })));
